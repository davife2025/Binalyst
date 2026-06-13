/**
 * lib/mantleAgentLoop.ts — Session N1 (new file)
 *
 * Shared types & helpers for the Mantle AI Trading Agent loop.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * Parallel to lib/celoAgentLoop.ts (Celo payments agent) and
 * lib/agentLoop.ts (BNB trading agent) — fully independent of both.
 * Nothing here imports from, or is imported by, any existing Binalyst file.
 *
 * The Mantle agent executes AI-driven trading decisions on Mantle Network,
 * using Bybit market data and the existing Binalyst signal engine.
 * On-chain benchmarking records every decision permanently on Mantle —
 * The Turing Test Hackathon's defining feature #1.
 */

import { MANTLE_AGENT_DEFAULTS } from './mantle/config'

export const MANTLE_LOOP_INTERVAL_MS = MANTLE_AGENT_DEFAULTS.LOOP_INTERVAL_MS

// ─────────────────────────────────────────────────────────────────────────────
// Agent status
// ─────────────────────────────────────────────────────────────────────────────

export type MantleLoopStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'error'
  | 'circuit_breaker'  // drawdown limit hit — auto-pause

// ─────────────────────────────────────────────────────────────────────────────
// Trade record
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleTradeRecord {
  id:           string
  timestamp:    number
  symbol:       string          // Bybit pair, e.g. 'MNTUSDT'
  tokenSymbol:  string          // on-chain token, e.g. 'MNT'
  side:         'BUY' | 'SELL'
  amountUSD:    number
  price:        number          // entry price (USDT)
  txHash:       string          // on-chain transaction hash ('' if simulated)
  status:       'confirmed' | 'failed' | 'blocked' | 'simulated'
  dryRun:       boolean
  signalScore:  number          // 0–100
  reasoning:    string          // human-readable signal reasoning
  benchmarkTx?: string          // on-chain benchmark record tx hash (N2)
  pnlUSD?:      number          // realised PnL when position is closed
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain benchmark record
// The Turing Test Hackathon — defining feature #1:
// "Every agent decision and outcome is recorded on Mantle."
// ─────────────────────────────────────────────────────────────────────────────

export interface BenchmarkRecord {
  v:          1                    // version — for forward compatibility
  agent:      string               // agent wallet address
  ts:         number               // Unix timestamp ms
  symbol:     string               // trading pair
  decision:   'BUY' | 'SELL' | 'HOLD'
  score:      number               // signal score 0–100
  price:      number               // price at decision time
  executed:   boolean              // whether the trade was actually sent
  txHash?:    string               // trade tx hash if executed
  reason:     string               // brief reasoning string
}

/** Encode a BenchmarkRecord as a compact JSON string (≤ 300 bytes). */
export function encodeBenchmarkRecord(r: BenchmarkRecord): string {
  return JSON.stringify({
    v: r.v,
    a: r.agent.slice(0, 10),   // truncated for size
    ts: r.ts,
    s: r.symbol,
    d: r.decision,
    sc: r.score,
    p: r.price,
    ex: r.executed,
    tx: r.txHash ?? '',
    rs: r.reason.slice(0, 80), // truncated
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop cycle result
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleLoopCycleResult {
  cycleAt:         number
  trades:          MantleTradeRecord[]
  decisions:       number     // total decisions evaluated
  executed:        number     // trades executed (or simulated)
  blocked:         number     // guardrail-blocked decisions
  errors:          string[]
  portfolioUSD:    number
  mntBalance:      number
  mntPrice:        number
  benchmarkCount:  number     // decisions recorded on-chain
  status:          MantleLoopStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent session
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleAgentSession {
  startedAt:       number
  startValueUSD:   number
  currentValueUSD: number
  peakValueUSD:    number
  drawdownPct:     number
  totalTrades:     number
  todayTrades:     number
  totalPnlUSD:     number
  lastRunAt:       number | null
  status:          MantleLoopStatus
  benchmarkCount:  number   // total on-chain benchmark records written
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent config
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleAgentConfig {
  dryRun:         boolean   // simulate trades without sending txs (default true)
  autonomousMode: boolean   // if false, decisions are evaluated but not executed
  enableBenchmark: boolean  // write decisions to Mantle on-chain log (default true)
  symbols:        string[]  // Bybit pairs to watch, e.g. ['MNTUSDT', 'ETHUSDT']
  positionSizePct: number   // % of portfolio per trade (overrides default)
}

export const DEFAULT_MANTLE_AGENT_CONFIG: MantleAgentConfig = {
  dryRun:          true,
  autonomousMode:  false,
  enableBenchmark: true,
  symbols:         ['MNTUSDT', 'ETHUSDT', 'BTCUSDT'],
  positionSizePct: MANTLE_AGENT_DEFAULTS.MAX_TRADE_PCT,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Compute drawdown % from peak value. */
export function computeDrawdown(currentUSD: number, peakUSD: number): number {
  if (peakUSD <= 0) return 0
  return Math.max(0, ((peakUSD - currentUSD) / peakUSD) * 100)
}

/** Compute PnL % from start value. */
export function computePnLPct(currentUSD: number, startUSD: number): number {
  if (startUSD <= 0) return 0
  return ((currentUSD - startUSD) / startUSD) * 100
}

/** Format a Mantle explorer URL for a transaction. */
export function mantleExplorerTx(
  hash:    string,
  network: 'mainnet' | 'testnet' = 'mainnet',
): string {
  const base = network === 'mainnet'
    ? 'https://explorer.mantle.xyz'
    : 'https://explorer.sepolia.mantle.xyz'
  return `${base}/tx/${hash}`
}

/** Short address display: 0x1234…abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format USD with 2 decimal places and $ sign. */
export function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits:  2,
    maximumFractionDigits:  2,
  })
}

/** Format a % change with sign: +3.42% / -1.20% */
export function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
