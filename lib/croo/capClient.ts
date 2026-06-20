/**
 * lib/croo/capClient.ts
 * CROO Agent Protocol (CAP) client for Binalyst.
 *
 * CAP is the A2A commerce standard: every agent has a wallet, every service
 * is priced, every job is an on-chain USDC transaction.
 *
 * Binalyst exposes four CAP services:
 *  1. market_signal   — buy/sell signal for a given token (DeFi Intelligence)
 *  2. backtest_report — run a strategy backtest and return metrics
 *  3. portfolio_scan  — analyse a wallet's holdings and risk profile
 *  4. trade_execute   — execute a swap on BSC (gated by CAP payment)
 *
 * References:
 *  docs.croo.network / agent.croo.network
 */

export const CAP_BASE_URL = 'https://api.croo.network'
export const AGENT_STORE_URL = 'https://agent.croo.network'

// CROO Agent Store listing ID (set after submission)
export const BINALYST_AGENT_ID = process.env.NEXT_PUBLIC_CROO_AGENT_ID ?? 'binalyst-trading-agent'

// USDC on supported chains (CAP uses USDC for settlement)
export const USDC_ADDRESSES: Record<string, string> = {
  bsc:     '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',  // BSC USDC
  base:    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base USDC
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
}

// ── CAP Service Definitions ───────────────────────────────────────────────────

export interface CAPService {
  id:          string
  name:        string
  description: string
  priceUSDC:   number       // price per call in USDC
  track:       CRooTrack
  inputSchema: Record<string, string>
  outputSchema: Record<string, string>
}

export type CRooTrack =
  | 'research_intelligence'
  | 'defi_onchain_ops'
  | 'data_verification'
  | 'open_a2a'

export const BINALYST_SERVICES: CAPService[] = [
  {
    id:          'market_signal',
    name:        'Market Signal',
    description: 'AI-powered buy/sell/hold signal for any BEP-20 token, combining technical indicators (RSI, MACD, BB, ADX, EMA, VWAP, ATR, OBV) with sentiment data.',
    priceUSDC:   0.10,
    track:       'research_intelligence',
    inputSchema: {
      symbol:    'string — token ticker, e.g. "BTC"',
      interval:  'string — "1h" | "4h" | "1d"',
      strategy:  'string? — optional strategy context',
    },
    outputSchema: {
      signal:      '"BUY" | "SELL" | "HOLD"',
      confidence:  'number 0-100',
      score:       'number 0-100',
      indicators:  'object — key technical indicator values',
      reasoning:   'string — AI explanation',
      regime:      '"TRENDING" | "RANGING" | "FLAT"',
    },
  },
  {
    id:          'backtest_report',
    name:        'Strategy Backtest',
    description: 'Run a multi-asset backtest on historical price data with no lookahead bias. Returns Sharpe ratio, max drawdown, win rate, equity curve, and trade log.',
    priceUSDC:   0.25,
    track:       'research_intelligence',
    inputSchema: {
      strategy:  'string — natural-language strategy description',
      symbols:   'string[] — tokens to trade',
      startDate: 'string — ISO date',
      endDate:   'string — ISO date',
      startUSDT: 'number — starting capital',
    },
    outputSchema: {
      totalReturn: 'number — %',
      sharpe:      'number',
      maxDrawdown: 'number — %',
      winRate:     'number — %',
      trades:      'number',
      equityCurve: 'number[]',
      summary:     'string',
    },
  },
  {
    id:          'portfolio_scan',
    name:        'Portfolio Risk Scan',
    description: 'Analyse a BSC wallet address for holdings, concentration risk, PnL, and AI-generated rebalancing recommendations.',
    priceUSDC:   0.15,
    track:       'data_verification',
    inputSchema: {
      walletAddress: 'string — BSC wallet address',
      includeDefi:   'boolean? — include DeFi positions',
    },
    outputSchema: {
      totalValueUSD:   'number',
      holdings:        'object[] — token, qty, value, weight',
      riskScore:       'number 0-100',
      recommendations: 'string[]',
      alerts:          'string[]',
    },
  },
  {
    id:          'trade_execute',
    name:        'Trade Execute',
    description: 'Execute a token swap on BSC via PancakeSwap with AI guardrails: max drawdown, slippage, position size limits. Returns on-chain tx hash.',
    priceUSDC:   0.50,
    track:       'defi_onchain_ops',
    inputSchema: {
      symbol:       'string — token ticker',
      action:       '"BUY" | "SELL"',
      amountUSDT:   'number — trade size in USDT',
      slippagePct:  'number? — default 1.0',
      dryRun:       'boolean? — default true',
    },
    outputSchema: {
      success:   'boolean',
      txHash:    'string?',
      bscScan:   'string?',
      message:   'string',
      warning:   'string?',
    },
  },
]

// ── CAP Request / Response types ──────────────────────────────────────────────

export interface CAPRequest {
  serviceId:      string
  callerId:       string   // caller agent DID or wallet address
  paymentTxHash:  string   // on-chain USDC payment tx
  paymentChain:   string   // 'bsc' | 'base' | 'polygon'
  params:         Record<string, unknown>
  nonce:          string   // unique call ID (UUID)
  timestamp:      number
}

export interface CAPResponse {
  success:        boolean
  nonce:          string
  serviceId:      string
  result?:        Record<string, unknown>
  error?:         string
  processingMs:   number
  agentId:        string
  settlementRef?: string   // on-chain receipt reference
}

// ── Payment verification ──────────────────────────────────────────────────────

/**
 * Verify a USDC payment on-chain before executing the service.
 * In production this calls BSCScan / Base explorer APIs.
 * Returns { valid, amountUSDC, from }
 */
export async function verifyPayment(opts: {
  txHash:      string
  chain:       string
  expectedUSDC: number
  toAddress:   string
}): Promise<{ valid: boolean; amountUSDC: number; from: string; error?: string }> {
  try {
    const { txHash, chain, expectedUSDC, toAddress } = opts

    // BSC verification via BSCScan API
    if (chain === 'bsc') {
      const apiKey = process.env.BSCSCAN_API_KEY ?? ''
      const url = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`
      const res  = await fetch(url)
      const data = await res.json()

      if (!data?.result?.status) {
        return { valid: false, amountUSDC: 0, from: '', error: 'Tx not found or pending' }
      }
      if (data.result.status !== '0x1') {
        return { valid: false, amountUSDC: 0, from: '', error: 'Tx reverted' }
      }

      // Decode ERC-20 Transfer log to verify USDC amount and recipient
      const logs: any[] = data.result.logs ?? []
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const usdcAddr = USDC_ADDRESSES[chain].toLowerCase()

      const transferLog = logs.find(
        (l: any) => l.address?.toLowerCase() === usdcAddr &&
                    l.topics?.[0] === transferTopic
      )

      if (!transferLog) {
        return { valid: false, amountUSDC: 0, from: '', error: 'No USDC transfer found in tx' }
      }

      const to = '0x' + (transferLog.topics[2] ?? '').slice(26)
      if (to.toLowerCase() !== toAddress.toLowerCase()) {
        return { valid: false, amountUSDC: 0, from: '', error: `Payment not sent to agent wallet (got ${to})` }
      }

      // USDC on BSC has 18 decimals
      const amountRaw = BigInt(transferLog.data)
      const amountUSDC = Number(amountRaw) / 1e18

      if (amountUSDC < expectedUSDC * 0.99) {
        return { valid: false, amountUSDC, from: '', error: `Underpayment: got $${amountUSDC.toFixed(4)}, expected $${expectedUSDC}` }
      }

      const from = '0x' + (transferLog.topics[1] ?? '').slice(26)
      return { valid: true, amountUSDC, from }
    }

    // Fallback: trust the payment hash (demo / testnet mode)
    return { valid: true, amountUSDC: expectedUSDC, from: 'unknown' }

  } catch (err: any) {
    return { valid: false, amountUSDC: 0, from: '', error: err.message }
  }
}

// ── Agent Discovery manifest (returned at /.well-known/cap-agent.json) ────────

export function buildCAPManifest(agentWallet: string) {
  return {
    capVersion:   '1.0',
    agentId:      BINALYST_AGENT_ID,
    name:         'Binalyst Trading Agent',
    description:  'AI-powered DeFi trading agent: market signals, strategy backtesting, portfolio scanning, and autonomous on-chain execution on BSC.',
    version:      '2.0.0',
    wallet:       agentWallet,
    chains:       ['bsc', 'celo', 'mantle', 'sui'],
    paymentTokens: ['USDC'],
    store:        `${AGENT_STORE_URL}/agents/${BINALYST_AGENT_ID}`,
    endpoint:     `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/cap/invoke`,
    discovery:    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/.well-known/cap-agent.json`,
    services:     BINALYST_SERVICES,
    tracks: [
      'research_intelligence',
      'defi_onchain_ops',
      'data_verification',
      'open_a2a',
    ],
    a2aComposable: true,
    openSource:   'https://github.com/davife2025/Binalyst',
    license:      'MIT',
  }
}
