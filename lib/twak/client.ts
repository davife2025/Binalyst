/**
 * lib/twak/client.ts
 * Trust Wallet Agent Kit (TWAK) integration.
 * Handles self-custodial wallet connection, local signing, and autonomous mode.
 * Keys NEVER leave the user's device — all signing is local.
 *
 * Docs: https://portal.trustwallet.com
 */

import { ethers } from 'ethers'

// BSC Mainnet
export const BSC_CHAIN_ID    = 56
export const BSC_RPC         = 'https://bsc-dataseed1.binance.org'
export const BSC_RPC_BACKUP  = 'https://bsc-dataseed2.binance.org'

// Competition contract on BSC
export const COMPETITION_CONTRACT = '0x212c61b9b72c95d95bf29cf032f5e5635629aed5'

// BNB AI Agent SDK PancakeSwap router (v2, BSC)
export const PANCAKE_ROUTER   = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
export const PANCAKE_FACTORY  = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
export const WBNB_ADDRESS     = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
export const USDT_BSC_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'

export interface TWAKWallet {
  address: string
  chainId: number
  provider: ethers.JsonRpcProvider
  signer:   ethers.Wallet
}

export interface AgentConfig {
  maxDrawdownPct:   number    // e.g. 25 — disqualify above 30
  maxPerTradePct:   number    // % of portfolio per trade
  maxDailyTrades:   number
  allowedTokens:    string[]  // BEP-20 contract addresses
  slippagePct:      number    // e.g. 1.0
  dryRun:           boolean
  autonomousMode:   boolean
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxDrawdownPct:  25,
  maxPerTradePct:  10,
  maxDailyTrades:  10,
  allowedTokens:   [],        // filled from CMC eligible list
  slippagePct:     1.0,
  dryRun:          true,      // safe default
  autonomousMode:  false,
}

// ─────────────────────────────────────────────────────────────────────────────
// TWAKClient — local signing, self-custodial
// ─────────────────────────────────────────────────────────────────────────────
export class TWAKClient {
  private wallet: ethers.Wallet
  private provider: ethers.JsonRpcProvider
  public  address: string

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(BSC_RPC)
    this.wallet   = new ethers.Wallet(privateKey, this.provider)
    this.address  = this.wallet.address
  }

  /** Get BNB balance */
  async getBNBBalance(): Promise<number> {
    const bal = await this.provider.getBalance(this.address)
    return parseFloat(ethers.formatEther(bal))
  }

  /** Get BEP-20 token balance */
  async getTokenBalance(tokenAddress: string): Promise<number> {
    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
    ]
    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider)
    const [bal, decimals] = await Promise.all([
      contract.balanceOf(this.address),
      contract.decimals(),
    ])
    return parseFloat(ethers.formatUnits(bal, decimals))
  }

  /** Register in competition contract */
  async registerForCompetition(): Promise<{ txHash: string; success: boolean; message: string }> {
    const abi = ['function register() external']
    const contract = new ethers.Contract(COMPETITION_CONTRACT, abi, this.wallet)
    try {
      const tx  = await contract.register({ gasLimit: 100000 })
      const rec = await tx.wait()
      return {
        txHash:  rec.hash,
        success: true,
        message: `Registered! Tx: ${rec.hash}`,
      }
    } catch (err: any) {
      // If already registered, not fatal
      const msg = err?.reason || err?.message || 'Registration failed'
      if (msg.toLowerCase().includes('already')) {
        return { txHash: '', success: true, message: 'Already registered for competition.' }
      }
      return { txHash: '', success: false, message: msg }
    }
  }

  /** Check if registered */
  async isRegistered(): Promise<boolean> {
    const abi = ['function isRegistered(address) view returns (bool)']
    try {
      const contract = new ethers.Contract(COMPETITION_CONTRACT, abi, this.provider)
      return await contract.isRegistered(this.address)
    } catch {
      return false
    }
  }

  /** Sign a message (proof of ownership) */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message)
  }

  /** Approve token spend for router */
  async approveToken(
    tokenAddress: string,
    spender: string,
    amountWei: bigint
  ): Promise<string> {
    const abi = ['function approve(address spender, uint256 amount) returns (bool)']
    const contract = new ethers.Contract(tokenAddress, abi, this.wallet)
    const tx  = await contract.approve(spender, amountWei, { gasLimit: 100000 })
    const rec = await tx.wait()
    return rec.hash
  }

  /** Execute a swap via PancakeSwap V2 */
  async swapExactTokensForTokens({
    amountIn,
    amountOutMin,
    path,
    deadline,
  }: {
    amountIn:     bigint
    amountOutMin: bigint
    path:         string[]
    deadline?:    number
  }): Promise<{ txHash: string; success: boolean }> {
    const routerAbi = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    ]
    const router = new ethers.Contract(PANCAKE_ROUTER, routerAbi, this.wallet)
    const dl     = deadline ?? Math.floor(Date.now() / 1000) + 300 // 5 min

    try {
      const tx  = await router.swapExactTokensForTokens(
        amountIn, amountOutMin, path, this.address, dl,
        { gasLimit: 300000 }
      )
      const rec = await tx.wait()
      return { txHash: rec.hash, success: true }
    } catch (err: any) {
      console.error('[TWAK swap]', err.message)
      return { txHash: '', success: false }
    }
  }

  /** Get token price via PancakeSwap (USDT quote) */
  async getTokenPriceUSDT(tokenAddress: string, decimals = 18): Promise<number> {
    const factoryAbi = [
      'function getPair(address tokenA, address tokenB) view returns (address pair)',
    ]
    const pairAbi = [
      'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() view returns (address)',
    ]
    try {
      const factory = new ethers.Contract(PANCAKE_FACTORY, factoryAbi, this.provider)
      const pairAddr = await factory.getPair(tokenAddress, USDT_BSC_ADDRESS)
      if (pairAddr === ethers.ZeroAddress) return 0
      const pair   = new ethers.Contract(pairAddr, pairAbi, this.provider)
      const [r0, r1] = await pair.getReserves()
      const token0   = await pair.token0()
      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase()
      const tokenRes = isToken0 ? r0 : r1
      const usdtRes  = isToken0 ? r1 : r0
      return (parseFloat(ethers.formatUnits(usdtRes, 18)) /
              parseFloat(ethers.formatUnits(tokenRes, decimals)))
    } catch {
      return 0
    }
  }

  /** Estimate gas for a swap */
  async estimateSwapGas(path: string[], amountIn: bigint): Promise<bigint> {
    try {
      const routerAbi = [
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      ]
      const router = new ethers.Contract(PANCAKE_ROUTER, routerAbi, this.provider)
      return await router.swapExactTokensForTokens.estimateGas(
        amountIn, 0n, path, this.address, Math.floor(Date.now() / 1000) + 300
      )
    } catch {
      return 300000n
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet utils — browser-side only
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a fresh agent wallet (browser) */
export function generateAgentWallet(): { address: string; privateKey: string; mnemonic: string } {
  const wallet = ethers.Wallet.createRandom()
  return {
    address:    wallet.address,
    privateKey: wallet.privateKey,
    mnemonic:   wallet.mnemonic?.phrase ?? '',
  }
}

/** Derive wallet from mnemonic */
export function walletFromMnemonic(mnemonic: string): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.fromPhrase(mnemonic)
  return { address: wallet.address, privateKey: wallet.privateKey }
}

/** Encrypt private key with user password (AES via browser) */
export async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const wallet    = new ethers.Wallet(privateKey)
  const encrypted = await wallet.encrypt(password)
  return encrypted
}

/** Decrypt private key */
export async function decryptPrivateKey(encryptedJson: string, password: string): Promise<string> {
  const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, password)
  return wallet.privateKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligible BEP-20 token addresses on BSC (competition list — subset with known addresses)
// ─────────────────────────────────────────────────────────────────────────────
export const ELIGIBLE_TOKENS: Record<string, { symbol: string; address: string; decimals: number }> = {
  USDT:   { symbol: 'USDT',   address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  USDC:   { symbol: 'USDC',   address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  ETH:    { symbol: 'ETH',    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
  XRP:    { symbol: 'XRP',    address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18 },
  DOGE:   { symbol: 'DOGE',   address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8  },
  ADA:    { symbol: 'ADA',    address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18 },
  LINK:   { symbol: 'LINK',   address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18 },
  DAI:    { symbol: 'DAI',    address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
  AVAX:   { symbol: 'AVAX',   address: '0x1CE0c2827e2eF14D5C4f29a091d735A204794041', decimals: 18 },
  SHIB:   { symbol: 'SHIB',   address: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D', decimals: 18 },
  DOT:    { symbol: 'DOT',    address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18 },
  UNI:    { symbol: 'UNI',    address: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', decimals: 18 },
  CAKE:   { symbol: 'CAKE',   address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
  AAVE:   { symbol: 'AAVE',   address: '0xfb6115445Bff7b52FeB98650C87f44907E58f802', decimals: 18 },
  ATOM:   { symbol: 'ATOM',   address: '0x0Eb3a705fc54725037CC9e008bDede697f62F335', decimals: 18 },
  FIL:    { symbol: 'FIL',    address: '0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', decimals: 18 },
  FLOKI:  { symbol: 'FLOKI',  address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37A', decimals: 9  },
  PENDLE: { symbol: 'PENDLE', address: '0xB5C064F955D8e7F38fE0460C556a72987494eE17', decimals: 18 },
  AXS:    { symbol: 'AXS',    address: '0x715D400F88C167884bbCc41C5FeA407ed4D2f8A0', decimals: 18 },
  TWT:    { symbol: 'TWT',    address: '0x4B0F1812e5Df2A09796481Ff14017e6005508003', decimals: 18 },
  COMP:   { symbol: 'COMP',   address: '0x52CE071Bd9b1C4B00A0b92D298c512478CaD67e8', decimals: 18 },
  SNX:    { symbol: 'SNX',    address: '0x9Ac983826058b8a9C7Aa1C9171441191232E8404', decimals: 18 },
  SUSHI:  { symbol: 'SUSHI',  address: '0x947950BcC74888a40Ffa2593C5798F11Fc9124C', decimals: 18  },
  ZIL:    { symbol: 'ZIL',    address: '0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787', decimals: 12 },
  KAVA:   { symbol: 'KAVA',   address: '0x5F88AB06e8dfe89DF127B2430Bba4Af600866035', decimals: 6  },
  FDUSD:  { symbol: 'FDUSD',  address: '0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409', decimals: 18 },
  BTT:    { symbol: 'BTT',    address: '0x352Cb5E19b12FC216548a2677bD0fce83BaE434B', decimals: 18 },
  LDO:    { symbol: 'LDO',    address: '0x986854779804799C1d68867F5E03e601E781e41b', decimals: 18 },
  BAT:    { symbol: 'BAT',    address: '0x101d82428437127bF1608F699CD651e6Abf9766E', decimals: 18 },
  APE:    { symbol: 'APE',    address: '0xC762043E211571eB34f1ef377e5e8e76914962f9', decimals: 18 },
}
