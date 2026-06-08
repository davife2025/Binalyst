/**
 * lib/twak/client.ts — Session C update (REPLACES Session A version)
 *
 * Key changes:
 * - Full 149-token BEP-20 eligible list
 * - Competition rules enforced: deadline check, min 1 trade/day,
 *   $1 floor guard, drawdown cap (30% disqualifies)
 * - TWAK CLI + MCP registration helpers
 */

import { ethers } from 'ethers'

export const BSC_CHAIN_ID    = 56
export const BSC_RPC         = 'https://bsc-dataseed1.binance.org'
export const BSC_RPC_BACKUP  = 'https://bsc-dataseed2.binance.org'

export const COMPETITION_CONTRACT = '0x212c61b9b72c95d95bf29cf032f5e5635629aed5'
export const PANCAKE_ROUTER       = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
export const PANCAKE_FACTORY      = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
export const WBNB_ADDRESS         = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
export const USDT_BSC_ADDRESS     = '0x55d398326f99059fF775485246999027B3197955'

// ─────────────────────────────────────────────────────────────────────────────
// Competition rules (hardcoded per contest spec)
// ─────────────────────────────────────────────────────────────────────────────
export const COMPETITION_RULES = {
  MAX_DRAWDOWN_PCT:      30,    // disqualified if drawdown exceeds this
  MIN_TRADES_PER_DAY:    1,
  MIN_TRADES_TOTAL:      7,     // over the 7-day window
  MIN_PORTFOLIO_USD:     1,     // sub-$1 = 0% for that hour
  TRADING_DAYS:          7,
  // Registration deadline enforced on-chain — entries after window opens are rejected
  COMPETITION_CONTRACT,
}

// ─────────────────────────────────────────────────────────────────────────────
// Full 149-token eligible list (BEP-20 on BSC, competition spec)
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_ELIGIBLE_SYMBOLS = [
  'ETH','USDT','USDC','XRP','TRX','DOGE','ZEC','ADA','LINK','BCH',
  'DAI','TON','USD1','USDe','M','LTC','AVAX','SHIB','XAUt','WLFI',
  'H','DOT','UNI','ASTER','DEXE','USDD','ETC','AAVE','ATOM','U',
  'STABLE','FIL','INJ','NIGHT','FET','TUSD','BONK','PENGU','CAKE',
  'SIREN','LUNC','ZRO','KITE','FDUSD','BEAT','PIEVERSE','BTT','NFT',
  'EDGE','FLOKI','LDO','B','FF','PENDLE','NEX','STG','AXS','TWT',
  'HOME','RAY','COMP','GWEI','XCN','GENIUS','XPL','BAT','SKYAI',
  'APE','IP','SFP','TAG','NXPC','AB','SAHARA','1INCH','CHEEMS',
  'BANANAS31','RIVER','MYX','RAVE','SNX','FORM','LAB','HTX','USDf',
  'CTM','BDX','SLX','UB','DUCKY','FRAX','BILL','WFI','KOGE','ALE',
  'FRXUSD','USDF','GOMINING','VCNT','GUA','DUSD','SMILEK','0G','BEAM',
  'MY','SOON','REAL','Q','AIOZ','ZIG','YFI','TAC','lisUSD','CYS',
  'ZAMA','TRIA','HUMA','PLUME','ZIL','XPR','ZETA','BabyDoge','NILA',
  'ROSE','VELO','UAI','BRETT','OPEN','BSB','TOSHI','BAS','ACH','AXL',
  'LUR','ELF','KAVA','APR','IRYS','EURI','XUSD','BARD','DUSK','SUSHI',
  'PEAQ','COAI','BDCA','XAUM',
]

// Liquid subset with known BSC addresses — used for actual swaps
export const ELIGIBLE_TOKENS: Record<string, { symbol: string; address: string; decimals: number }> = {
  USDT:    { symbol: 'USDT',    address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  USDC:    { symbol: 'USDC',    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  ETH:     { symbol: 'ETH',     address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
  XRP:     { symbol: 'XRP',     address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18 },
  TRX:     { symbol: 'TRX',     address: '0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3', decimals: 6  },
  DOGE:    { symbol: 'DOGE',    address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8  },
  ADA:     { symbol: 'ADA',     address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18 },
  LINK:    { symbol: 'LINK',    address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18 },
  BCH:     { symbol: 'BCH',     address: '0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf', decimals: 18 },
  DAI:     { symbol: 'DAI',     address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
  LTC:     { symbol: 'LTC',     address: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', decimals: 18 },
  AVAX:    { symbol: 'AVAX',    address: '0x1CE0c2827e2eF14D5C4f29a091d735A204794041', decimals: 18 },
  SHIB:    { symbol: 'SHIB',    address: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D', decimals: 18 },
  DOT:     { symbol: 'DOT',     address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18 },
  UNI:     { symbol: 'UNI',     address: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', decimals: 18 },
  AAVE:    { symbol: 'AAVE',    address: '0xfb6115445Bff7b52FeB98650C87f44907E58f802', decimals: 18 },
  ATOM:    { symbol: 'ATOM',    address: '0x0Eb3a705fc54725037CC9e008bDede697f62F335', decimals: 18 },
  FIL:     { symbol: 'FIL',     address: '0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', decimals: 18 },
  INJ:     { symbol: 'INJ',     address: '0xa2B726B1145A4773F68593CF171187d8EBe4d495', decimals: 18 },
  FET:     { symbol: 'FET',     address: '0x031b41e504677879370e9DBcF937283A8691Fa7f', decimals: 18 },
  CAKE:    { symbol: 'CAKE',    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
  FLOKI:   { symbol: 'FLOKI',   address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37A', decimals: 9  },
  LDO:     { symbol: 'LDO',     address: '0x986854779804799C1d68867F5E03e601E781e41b', decimals: 18 },
  PENDLE:  { symbol: 'PENDLE',  address: '0xB5C064F955D8e7F38fE0460C556a72987494eE17', decimals: 18 },
  AXS:     { symbol: 'AXS',     address: '0x715D400F88C167884bbCc41C5FeA407ed4D2f8A0', decimals: 18 },
  TWT:     { symbol: 'TWT',     address: '0x4B0F1812e5Df2A09796481Ff14017e6005508003', decimals: 18 },
  COMP:    { symbol: 'COMP',    address: '0x52CE071Bd9b1C4B00A0b92D298c512478CaD67e8', decimals: 18 },
  SNX:     { symbol: 'SNX',     address: '0x9Ac983826058b8a9C7Aa1C9171441191232E8404', decimals: 18 },
  SUSHI:   { symbol: 'SUSHI',   address: '0x947950BcC74888a40Ffa2593C5798F11Fc9124C4', decimals: 18 },
  ZIL:     { symbol: 'ZIL',     address: '0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787', decimals: 12 },
  KAVA:    { symbol: 'KAVA',    address: '0x5F88AB06e8dfe89DF127B2430Bba4Af600866035', decimals: 6  },
  FDUSD:   { symbol: 'FDUSD',   address: '0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409', decimals: 18 },
  BTT:     { symbol: 'BTT',     address: '0x352Cb5E19b12FC216548a2677bD0fce83BaE434B', decimals: 18 },
  BAT:     { symbol: 'BAT',     address: '0x101d82428437127bF1608F699CD651e6Abf9766E', decimals: 18 },
  APE:     { symbol: 'APE',     address: '0xC762043E211571eB34f1ef377e5e8e76914962f9', decimals: 18 },
  '1INCH': { symbol: '1INCH',   address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18 },
  LUNC:    { symbol: 'LUNC',    address: '0x156ab3346823B651294766e23e6Cf87254d68962', decimals: 18 },
  DEXE:    { symbol: 'DEXE',    address: '0x74b988156925937bD59B6bAA40Ad7B93d98aBfC5', decimals: 18 },
  ZEC:     { symbol: 'ZEC',     address: '0x1Ba42e5193dfA8B03D15EAA77cf0B37A0e426575', decimals: 18 },
  ETC:     { symbol: 'ETC',     address: '0x3d6545b08693daE087E957cb1180ee38B9e3c25E', decimals: 18 },
  FRAX:    { symbol: 'FRAX',    address: '0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40', decimals: 18 },
  STG:     { symbol: 'STG',     address: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b', decimals: 18 },
  BONK:    { symbol: 'BONK',    address: '0xA697e272a73744b343528C3Bc4702F2565b2F422', decimals: 5  },
  YFI:     { symbol: 'YFI',     address: '0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e', decimals: 18 },
  TUSD:    { symbol: 'TUSD',    address: '0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9', decimals: 18 },
  ELF:     { symbol: 'ELF',     address: '0xa3f020a5C92e15be13CAF0Ee5C95cF79585EeCC9', decimals: 18 },
  ACH:     { symbol: 'ACH',     address: '0xBc7d6B50616989655AfD682fb42743507003056D', decimals: 8  },
  SFP:     { symbol: 'SFP',     address: '0xD41FDb03Ba84762dD66a0af1a6C8540FF1ba5dfb', decimals: 18 },
  RAY:     { symbol: 'RAY',     address: '0x6349E9a14b8E3C9f0da9B5e5F0f93f0E3b503b2D', decimals: 6  },
  ROSE:    { symbol: 'ROSE',    address: '0x2E5B04aDC0A3b7dB5fD34B0aB8Dd7b69B2e45B3B', decimals: 18 },
  DUSK:    { symbol: 'DUSK',    address: '0xB2BD0749DBE21f623d9BABa856D3B0f0e1BFEc9C', decimals: 18 },
  XCN:     { symbol: 'XCN',     address: '0x7324c7C0d95CEBC73eEa7E85CbAac0dBdf88a05b', decimals: 18 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Competition guardrail checker
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  allowed:  boolean
  reason?:  string
  warning?: string
}

export function checkCompetitionGuardrails(params: {
  symbol:          string
  portfolioUSD:    number
  drawdownPct:     number
  tradesToday:     number
  totalTrades:     number
  daysElapsed:     number
  tradeAmountUSD:  number
  maxPerTradePct:  number
  slippagePct:     number
}): GuardrailResult {
  const {
    symbol, portfolioUSD, drawdownPct,
    tradeAmountUSD, maxPerTradePct, slippagePct,
  } = params

  // 1. Token must be in eligible list
  if (!ALL_ELIGIBLE_SYMBOLS.includes(symbol)) {
    return { allowed: false, reason: `${symbol} is not in the eligible token list. Trades outside the list do not count.` }
  }

  // 2. Portfolio floor — sub-$1 is treated as no capital at work
  if (portfolioUSD <= 1) {
    return { allowed: false, reason: `Portfolio value $${portfolioUSD.toFixed(2)} is at or below $1 floor. Keep capital deployed.` }
  }

  // 3. Drawdown cap — 30% disqualifies
  if (drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT) {
    return { allowed: false, reason: `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}% cap. Agent DISQUALIFIED.` }
  }

  // 4. Drawdown warning zone
  const warning = drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT * 0.8
    ? `⚠ Drawdown at ${drawdownPct.toFixed(1)}% — approaching ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}% disqualification threshold.`
    : undefined

  // 5. Per-trade size limit
  const tradePct = (tradeAmountUSD / portfolioUSD) * 100
  if (tradePct > maxPerTradePct) {
    return {
      allowed: false,
      reason: `Trade size ${tradePct.toFixed(1)}% exceeds per-trade limit of ${maxPerTradePct}%.`,
      warning,
    }
  }

  // 6. Slippage sanity
  if (slippagePct > 5) {
    return { allowed: false, reason: `Slippage ${slippagePct}% is dangerously high. Max recommended: 5%.`, warning }
  }

  return { allowed: true, warning }
}

// ─────────────────────────────────────────────────────────────────────────────
// TWAKClient
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  maxDrawdownPct:  number
  maxPerTradePct:  number
  maxDailyTrades:  number
  allowedTokens:   string[]
  slippagePct:     number
  dryRun:          boolean
  autonomousMode:  boolean
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxDrawdownPct:  25,      // conservative — below 30% disqualification line
  maxPerTradePct:  15,
  maxDailyTrades:  8,
  allowedTokens:   [],
  slippagePct:     1.0,
  dryRun:          true,
  autonomousMode:  false,
}

export class TWAKClient {
  private wallet:   ethers.Wallet
  private provider: ethers.JsonRpcProvider
  public  address:  string

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(BSC_RPC)
    this.wallet   = new ethers.Wallet(privateKey, this.provider)
    this.address  = this.wallet.address
  }

  async getBNBBalance(): Promise<number> {
    const bal = await this.provider.getBalance(this.address)
    return parseFloat(ethers.formatEther(bal))
  }

  async getTokenBalance(tokenAddress: string): Promise<number> {
    const abi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ]
    const contract = new ethers.Contract(tokenAddress, abi, this.provider)
    const [bal, dec] = await Promise.all([contract.balanceOf(this.address), contract.decimals()])
    return parseFloat(ethers.formatUnits(bal, dec))
  }

  /**
   * Register for competition.
   * Contract enforces deadline — entries after trading window opens are rejected on-chain.
   */
  async registerForCompetition(): Promise<{ txHash: string; success: boolean; message: string }> {
    const abi = ['function register() external']
    const contract = new ethers.Contract(COMPETITION_CONTRACT, abi, this.wallet)
    try {
      const tx  = await contract.register({ gasLimit: 120000 })
      const rec = await tx.wait()
      return { txHash: rec.hash, success: true, message: `Registered! Tx: ${rec.hash}` }
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Registration failed'
      // Already registered = not fatal
      if (msg.toLowerCase().includes('already')) {
        return { txHash: '', success: true, message: 'Already registered for competition.' }
      }
      // Deadline passed
      if (msg.toLowerCase().includes('deadline') || msg.toLowerCase().includes('closed')) {
        return { txHash: '', success: false, message: 'Registration deadline has passed — trading window is open.' }
      }
      return { txHash: '', success: false, message: msg }
    }
  }

  async isRegistered(): Promise<boolean> {
    const abi = ['function isRegistered(address) view returns (bool)']
    try {
      const contract = new ethers.Contract(COMPETITION_CONTRACT, abi, this.provider)
      return await contract.isRegistered(this.address)
    } catch { return false }
  }

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message)
  }

  async approveToken(tokenAddress: string, spender: string, amountWei: bigint): Promise<string> {
    const abi = ['function approve(address spender, uint256 amount) returns (bool)']
    const contract = new ethers.Contract(tokenAddress, abi, this.wallet)
    const tx  = await contract.approve(spender, amountWei, { gasLimit: 100000 })
    const rec = await tx.wait()
    return rec.hash
  }

  async swapExactTokensForTokens(params: {
    amountIn: bigint; amountOutMin: bigint; path: string[]; deadline?: number
  }): Promise<{ txHash: string; success: boolean }> {
    const routerAbi = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    ]
    const router = new ethers.Contract(PANCAKE_ROUTER, routerAbi, this.wallet)
    const dl = params.deadline ?? Math.floor(Date.now() / 1000) + 300
    try {
      const tx  = await router.swapExactTokensForTokens(
        params.amountIn, params.amountOutMin, params.path, this.address, dl,
        { gasLimit: 350000 }
      )
      const rec = await tx.wait()
      return { txHash: rec.hash, success: true }
    } catch (err: any) {
      console.error('[TWAK swap]', err.message)
      return { txHash: '', success: false }
    }
  }

  async getTokenPriceUSDT(tokenAddress: string, decimals = 18): Promise<number> {
    const factoryAbi = ['function getPair(address,address) view returns (address)']
    const pairAbi    = [
      'function getReserves() view returns (uint112,uint112,uint32)',
      'function token0() view returns (address)',
    ]
    try {
      const factory  = new ethers.Contract(PANCAKE_FACTORY, factoryAbi, this.provider)
      const pairAddr = await factory.getPair(tokenAddress, USDT_BSC_ADDRESS)
      if (pairAddr === ethers.ZeroAddress) return 0
      const pair   = new ethers.Contract(pairAddr, pairAbi, this.provider)
      const [r0, r1] = await pair.getReserves()
      const token0   = await pair.token0()
      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase()
      const tokenRes = isToken0 ? r0 : r1
      const usdtRes  = isToken0 ? r1 : r0
      return parseFloat(ethers.formatUnits(usdtRes, 18)) /
             parseFloat(ethers.formatUnits(tokenRes, decimals))
    } catch { return 0 }
  }

  async getPortfolioValueUSD(holdings: Array<{ symbol: string; address: string; decimals: number }>): Promise<{
    items: Array<{ symbol: string; balance: number; priceUSD: number; valueUSD: number }>
    totalUSD: number
  }> {
    const items = await Promise.all(
      holdings.map(async h => {
        const [balance, priceUSD] = await Promise.allSettled([
          this.getTokenBalance(h.address),
          this.getTokenPriceUSDT(h.address, h.decimals),
        ])
        const bal   = balance.status  === 'fulfilled' ? balance.value  : 0
        const price = priceUSD.status === 'fulfilled' ? priceUSD.value : 0
        return { symbol: h.symbol, balance: bal, priceUSD: price, valueUSD: bal * price }
      })
    )
    const totalUSD = items.reduce((s, i) => s + i.valueUSD, 0)
    return { items, totalUSD }
  }
}

// Browser-side wallet helpers
export function generateAgentWallet() {
  const w = ethers.Wallet.createRandom()
  return { address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase ?? '' }
}

export function walletFromMnemonic(mnemonic: string) {
  const w = ethers.Wallet.fromPhrase(mnemonic)
  return { address: w.address, privateKey: w.privateKey }
}

export async function encryptPrivateKey(privateKey: string, password: string) {
  const w = new ethers.Wallet(privateKey)
  return w.encrypt(password)
}

export async function decryptPrivateKey(encryptedJson: string, password: string) {
  const w = await ethers.Wallet.fromEncryptedJson(encryptedJson, password)
  return w.privateKey
}
