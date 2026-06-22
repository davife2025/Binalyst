/**
 * lib/celo/client.ts — Session J (new file)
 *
 * CeloClient — execution layer for the Celo Payments Agent.
 * Mirrors the shape/conventions of lib/twak/client.ts (TWAKClient) for the
 * BNB competition agent, but is fully independent: separate provider,
 * separate wallet, separate guardrails. Nothing here is imported by, or
 * imports from, lib/twak/client.ts — the BNB agent is untouched.
 *
 * Hackathon framing: Onchain Agents — Real World Payments & Everyday
 * Applications (Celo). Core actions are native CELO / cUSD transfers
 * ("payments"), with optional Mento DEX swaps (mainnet only) for
 * rebalancing CELO -> cUSD before a payment.
 */

import { ethers } from 'ethers'
import {
  CeloNetwork,
  CELO_RPC,
  CELO_RPC_BACKUP,
  CELO_CHAIN_ID,
  CELO_TOKENS,
  CELO_AGENT_RULES,
  MENTO_BROKER_ADDRESS,
  MENTO_BIPOOL_MANAGER_ADDRESS,
  USD_REFERENCE_TOKEN,
  CeloTokenInfo,
} from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  allowed: boolean
  reason?: string
}

export function checkPaymentGuardrails(params: {
  tokenSymbol:      string
  network:          CeloNetwork
  amount:           number      // amount of tokenSymbol being sent
  tokenBalance:     number      // current balance of tokenSymbol
  celoBalance:      number      // current native CELO balance (for gas)
  amountUSD:        number      // estimated USD value of the payment
  paymentsToday:    number
}): GuardrailResult {
  const { tokenSymbol, network, amount, tokenBalance, celoBalance, amountUSD, paymentsToday } = params

  // 1. Token must be one we know about on this network
  if (!CELO_TOKENS[network][tokenSymbol]) {
    return { allowed: false, reason: `${tokenSymbol} is not a configured token on Celo ${network}.` }
  }

  // 2. Must have sufficient balance
  if (amount > tokenBalance) {
    return { allowed: false, reason: `Insufficient ${tokenSymbol} balance: have ${tokenBalance}, need ${amount}.` }
  }

  // 3. Must keep a minimum CELO reserve for gas (unless the payment itself is CELO)
  const reserveNeeded = tokenSymbol === 'CELO'
    ? amount + CELO_AGENT_RULES.MIN_NATIVE_GAS_RESERVE
    : CELO_AGENT_RULES.MIN_NATIVE_GAS_RESERVE
  if (celoBalance < reserveNeeded) {
    return { allowed: false, reason: `CELO balance ${celoBalance} would drop below gas reserve of ${CELO_AGENT_RULES.MIN_NATIVE_GAS_RESERVE}.` }
  }

  // 4. Per-payment cap — don't send more than MAX_PAYMENT_PCT of holdings in one go
  const maxAmount = tokenBalance * (CELO_AGENT_RULES.MAX_PAYMENT_PCT / 100)
  if (amount > maxAmount) {
    return { allowed: false, reason: `Payment of ${amount} ${tokenSymbol} exceeds ${CELO_AGENT_RULES.MAX_PAYMENT_PCT}% per-payment cap (${maxAmount.toFixed(4)}).` }
  }

  // 5. Dust floor
  if (amountUSD < CELO_AGENT_RULES.MIN_PAYMENT_USD) {
    return { allowed: false, reason: `Payment value $${amountUSD.toFixed(4)} is below the $${CELO_AGENT_RULES.MIN_PAYMENT_USD} dust floor.` }
  }

  // 6. Daily payment count cap
  if (paymentsToday >= CELO_AGENT_RULES.MAX_DAILY_PAYMENTS) {
    return { allowed: false, reason: `Daily payment cap of ${CELO_AGENT_RULES.MAX_DAILY_PAYMENTS} reached.` }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERC-20 ABI fragments
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]

const BROKER_ABI = [
  'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
  'function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut)',
]

const BIPOOL_MANAGER_ABI = [
  'function getExchanges() external view returns (tuple(bytes32 exchangeId, address[] assets)[] memory exchanges)',
]

// ─────────────────────────────────────────────────────────────────────────────
// CeloClient
// ─────────────────────────────────────────────────────────────────────────────

export class CeloClient {
  private provider: ethers.JsonRpcProvider
  private wallet:   ethers.Wallet
  public  address:  string
  public  network:  CeloNetwork
  private tokens:   Record<string, CeloTokenInfo>

  constructor(privateKey: string, network: CeloNetwork = 'alfajores') {
    this.network  = network
    this.provider = new ethers.JsonRpcProvider(CELO_RPC[network])
    this.wallet   = new ethers.Wallet(privateKey, this.provider)
    this.address  = this.wallet.address
    this.tokens   = CELO_TOKENS[network]
  }

  /** Fall back to backup RPC if the primary is unreachable. */
  private async withFallback<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    try {
      return await fn(this.provider)
    } catch (err) {
      const backup = new ethers.JsonRpcProvider(CELO_RPC_BACKUP[this.network])
      return fn(backup)
    }
  }

  // ── Balances ────────────────────────────────────────────────────────────

  async getCELOBalance(): Promise<number> {
    const bal = await this.withFallback(p => p.getBalance(this.address))
    return parseFloat(ethers.formatEther(bal))
  }

  async getTokenBalance(tokenAddress: string, decimals = 18): Promise<number> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
    const bal = await contract.balanceOf(this.address)
    return parseFloat(ethers.formatUnits(bal, decimals))
  }

  async getCUSDBalance(): Promise<number> {
    const cusd = this.tokens[USD_REFERENCE_TOKEN]
    if (!cusd) return 0
    return this.getTokenBalance(cusd.address, cusd.decimals)
  }

  // ── Transfers ("payments") ──────────────────────────────────────────────

  /** Send native CELO to an address. */
  async sendCELO(to: string, amount: number): Promise<{ txHash: string; success: boolean; error?: string }> {
    try {
      const tx  = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount.toString()),
      })
      const rec = await tx.wait()
      return { txHash: rec?.hash ?? tx.hash, success: true }
    } catch (err: any) {
      console.error('[Celo sendCELO]', err.message)
      return { txHash: '', success: false, error: err.message }
    }
  }

  /** Send an ERC-20 token (e.g. cUSD) to an address — the core "payment" action. */
  async sendToken(tokenAddress: string, to: string, amount: number, decimals = 18): Promise<{ txHash: string; success: boolean; error?: string }> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet)
      const value    = ethers.parseUnits(amount.toString(), decimals)
      const tx  = await contract.transfer(to, value, { gasLimit: 200_000 })
      const rec = await tx.wait()
      return { txHash: rec.hash, success: true }
    } catch (err: any) {
      console.error('[Celo sendToken]', err.message)
      return { txHash: '', success: false, error: err.message }
    }
  }

  /** Convenience: send a payment in cUSD. */
  async sendCUSD(to: string, amount: number): Promise<{ txHash: string; success: boolean; error?: string }> {
    const cusd = this.tokens[USD_REFERENCE_TOKEN]
    if (!cusd) return { txHash: '', success: false, error: 'cUSD not configured for this network' }
    return this.sendToken(cusd.address, to, amount, cusd.decimals)
  }

  async approveToken(tokenAddress: string, spender: string, amountWei: bigint): Promise<string> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet)
    const tx  = await contract.approve(spender, amountWei, { gasLimit: 100_000 })
    const rec = await tx.wait()
    return rec.hash
  }

  // ── Portfolio valuation ─────────────────────────────────────────────────

  /**
   * Returns CELO + cUSD balances valued in USD. cUSD is treated as 1:1 USD.
   * CELO is priced via a Mento quote (mainnet only); on testnet, or if the
   * quote fails, CELO is valued at 0 (conservative — won't overstate
   * portfolio value or unlock larger payment caps).
   */
  async getPortfolioValueUSD(): Promise<{
    celo: number
    cusd: number
    celoPriceUSD: number
    totalUSD: number
  }> {
    const [celo, cusd] = await Promise.all([
      this.getCELOBalance(),
      this.getCUSDBalance(),
    ])

    let celoPriceUSD = 0
    try {
      celoPriceUSD = await this.getCELOPriceUSD()
    } catch {
      celoPriceUSD = 0
    }

    return {
      celo,
      cusd,
      celoPriceUSD,
      totalUSD: cusd + celo * celoPriceUSD,
    }
  }

  // ── Mento DEX (mainnet only — Session K stretch goal) ──────────────────

  /** Find the Mento exchange ID + provider for a token pair. Mainnet only. */
  private async findMentoExchange(tokenA: string, tokenB: string): Promise<{ exchangeId: string; provider: string } | null> {
    const managerAddr = MENTO_BIPOOL_MANAGER_ADDRESS[this.network]
    if (!managerAddr) return null

    const manager = new ethers.Contract(managerAddr, BIPOOL_MANAGER_ABI, this.provider)
    const exchanges: Array<{ exchangeId: string; assets: string[] }> = await manager.getExchanges()

    const a = tokenA.toLowerCase()
    const b = tokenB.toLowerCase()
    const match = exchanges.find(ex => {
      const assets = ex.assets.map(x => x.toLowerCase())
      return assets.includes(a) && assets.includes(b)
    })

    return match ? { exchangeId: match.exchangeId, provider: managerAddr } : null
  }

  /** Quote how much tokenOut you'd receive for amountIn of tokenIn. Mainnet only. */
  async getMentoQuote(tokenInSymbol: string, tokenOutSymbol: string, amountIn: number): Promise<number> {
    const broker = MENTO_BROKER_ADDRESS[this.network]
    if (!broker) throw new Error(`Mento swaps not available on Celo ${this.network}`)

    const tokenIn  = this.tokens[tokenInSymbol]
    const tokenOut = this.tokens[tokenOutSymbol]
    if (!tokenIn || !tokenOut) throw new Error(`Unknown token pair ${tokenInSymbol}/${tokenOutSymbol}`)

    const exchange = await this.findMentoExchange(tokenIn.address, tokenOut.address)
    if (!exchange) throw new Error(`No Mento exchange found for ${tokenInSymbol}/${tokenOutSymbol}`)

    const brokerContract = new ethers.Contract(broker, BROKER_ABI, this.provider)
    const amountInWei = ethers.parseUnits(amountIn.toString(), tokenIn.decimals)
    const amountOutWei = await brokerContract.getAmountOut(
      exchange.provider, exchange.exchangeId, tokenIn.address, tokenOut.address, amountInWei,
    )
    return parseFloat(ethers.formatUnits(amountOutWei, tokenOut.decimals))
  }

  /** CELO price in USD via a 1 CELO -> cUSD Mento quote. Mainnet only. */
  async getCELOPriceUSD(): Promise<number> {
    if (this.network !== 'mainnet') return 0
    try {
      return await this.getMentoQuote('CELO', USD_REFERENCE_TOKEN, 1)
    } catch {
      return 0
    }
  }

  /** Swap tokenIn -> tokenOut via Mento, with a slippage tolerance (%). Mainnet only. */
  async swapViaMento(tokenInSymbol: string, tokenOutSymbol: string, amountIn: number, slippagePct = 1): Promise<{ txHash: string; success: boolean; amountOut?: number; error?: string }> {
    const broker = MENTO_BROKER_ADDRESS[this.network]
    if (!broker) return { txHash: '', success: false, error: `Mento swaps not available on Celo ${this.network}` }

    try {
      const tokenIn  = this.tokens[tokenInSymbol]
      const tokenOut = this.tokens[tokenOutSymbol]
      if (!tokenIn || !tokenOut) throw new Error(`Unknown token pair ${tokenInSymbol}/${tokenOutSymbol}`)

      const exchange = await this.findMentoExchange(tokenIn.address, tokenOut.address)
      if (!exchange) throw new Error(`No Mento exchange found for ${tokenInSymbol}/${tokenOutSymbol}`)

      const amountInWei = ethers.parseUnits(amountIn.toString(), tokenIn.decimals)

      // Ensure broker is approved to spend tokenIn
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, this.wallet)
      const allowance: bigint = await tokenContract.allowance(this.address, broker)
      if (allowance < amountInWei) {
        await this.approveToken(tokenIn.address, broker, amountInWei * BigInt(2))
      }

      const brokerContract = new ethers.Contract(broker, BROKER_ABI, this.wallet)
      const quotedOut = await brokerContract.getAmountOut(
        exchange.provider, exchange.exchangeId, tokenIn.address, tokenOut.address, amountInWei,
      )
      const minOut = quotedOut - (quotedOut * BigInt(Math.floor(slippagePct * 100))) / BigInt(10_000)

      const tx  = await brokerContract.swapIn(
        exchange.provider, exchange.exchangeId, tokenIn.address, tokenOut.address, amountInWei, minOut,
        { gasLimit: 500_000 },
      )
      const rec = await tx.wait()
      return { txHash: rec.hash, success: true, amountOut: parseFloat(ethers.formatUnits(quotedOut, tokenOut.decimals)) }
    } catch (err: any) {
      console.error('[Celo swapViaMento]', err.message)
      return { txHash: '', success: false, error: err.message }
    }
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message)
  }

  getChainId(): number {
    return CELO_CHAIN_ID[this.network]
  }

  /** Expose the underlying signer (e.g. for ad-hoc Contract instances — used by lib/celo/erc8004.ts). */
  getWallet(): ethers.Wallet {
    return this.wallet
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet helpers (independent of lib/twak/client.ts — same ethers primitives,
// kept local so the Celo agent module has no dependency on the BNB module)
// ─────────────────────────────────────────────────────────────────────────────

export function generateCeloWallet() {
  const w = ethers.Wallet.createRandom()
  return { address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase ?? '' }
}

export function celoWalletFromMnemonic(mnemonic: string) {
  const w = ethers.Wallet.fromPhrase(mnemonic)
  return { address: w.address, privateKey: w.privateKey }
}

export function celoWalletFromPrivateKey(privateKey: string) {
  const pk = privateKey.trim().startsWith('0x') ? privateKey.trim() : `0x${privateKey.trim()}`
  const w  = new ethers.Wallet(pk)
  return { address: w.address, privateKey: w.privateKey }
}

export async function encryptCeloPrivateKey(privateKey: string, password: string) {
  const w = new ethers.Wallet(privateKey)
  return w.encrypt(password)
}

export async function decryptCeloPrivateKey(encryptedJson: string, password: string) {
  const w = await ethers.Wallet.fromEncryptedJson(encryptedJson, password)
  return w.privateKey
}
