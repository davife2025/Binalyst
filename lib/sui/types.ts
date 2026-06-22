/**
 * lib/sui/types.ts
 * Shared type definitions for the Sui integration — Session J.
 *
 * These types are consumed by:
 *   - lib/suiAgent/agentLoop.ts
 *   - lib/walrus/client.ts
 *   - components/tabs/SuiAgentTab.tsx  (Session K)
 *   - lib/deepbook/client.ts           (Session M)
 *
 * ISOLATION GUARANTEE: no imports from existing Binalyst lib.
 */

import type { SuiNetwork } from './client'

// ─────────────────────────────────────────────────────────────────────────────
// Wallet
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiWalletState {
  address:        string | null
  network:        SuiNetwork
  balanceSUI:     number
  isConnected:    boolean
  isLoading:      boolean
  error:          string | null
  connectedAt:    number | null
}

export const INITIAL_WALLET_STATE: SuiWalletState = {
  address:     null,
  network:     'testnet',
  balanceSUI:  0,
  isConnected: false,
  isLoading:   false,
  error:       null,
  connectedAt: null,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sui agent session
// ─────────────────────────────────────────────────────────────────────────────

export type SuiAgentStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'error'
  | 'stopped'

export interface SuiAgentSession {
  status:          SuiAgentStatus
  startedAt:       number | null
  lastCycleAt:     number | null
  cycleCount:      number
  tradesExecuted:  number
  tradesBlocked:   number
  errors:          string[]
  network:         SuiNetwork
  walletAddress:   string | null
}

export const INITIAL_AGENT_SESSION: SuiAgentSession = {
  status:         'idle',
  startedAt:      null,
  lastCycleAt:    null,
  cycleCount:     0,
  tradesExecuted: 0,
  tradesBlocked:  0,
  errors:         [],
  network:        'testnet',
  walletAddress:  null,
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade records (Sui-side)
// ─────────────────────────────────────────────────────────────────────────────

export type SuiTradeAction = 'BUY' | 'SELL'
export type SuiTradeStatus = 'pending' | 'confirmed' | 'failed' | 'dry_run'

export interface SuiTradeRecord {
  id:             string
  timestamp:      number
  symbol:         string           // e.g. 'BTC', 'ETH', 'SUI'
  action:         SuiTradeAction
  amountUSD:      number
  price:          number
  txDigest?:      string           // Sui transaction digest
  status:         SuiTradeStatus
  signalScore:    number
  reasoning:      string
  walrusMemId?:   string           // MemWal blob ID (Session L)
  deepbookPool?:  string           // DeepBook pool ID (Session M)
  network:        SuiNetwork
  dryRun:         boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal snapshot (Sui agent's view — mirrors Binalyst SignalSnapshot shape
// but is a separate type to keep the modules decoupled)
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiSignalSnapshot {
  symbol:       string
  price:        number
  change24h:    number
  change1h:     number
  signalScore:  number           // 0–100
  signalDir:    'BUY' | 'SELL' | 'HOLD'
  confidence:   'HIGH' | 'MEDIUM' | 'LOW'
  reasoning:    string
  fearGreed:    number
  momentum:     number
  updatedAt:    number
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent config
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiAgentConfig {
  network:           SuiNetwork
  dryRun:            boolean          // true = simulate, no on-chain tx
  autonomousMode:    boolean          // false = log decisions only
  maxTradeUSD:       number           // max USD per trade
  minSignalScore:    number           // 0–100, minimum to act
  cycleIntervalMs:   number           // loop cadence (default 120_000)
  allowedSymbols:    string[]         // whitelist, e.g. ['SUI','BTC','ETH']
}

export const DEFAULT_SUI_AGENT_CONFIG: SuiAgentConfig = {
  network:          'testnet',
  dryRun:           true,
  autonomousMode:   false,
  maxTradeUSD:      50,
  minSignalScore:   65,
  cycleIntervalMs:  120_000,
  allowedSymbols:   ['SUI', 'BTC', 'ETH'],
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent decision (one per fired signal per cycle)
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiAgentDecision {
  symbol:       string
  action:       SuiTradeAction
  amountUSD:    number
  signalScore:  number
  reasoning:    string
  blocked:      boolean
  blockReason?: string
  txDigest?:    string
  timestamp:    number
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle result
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiCycleResult {
  cycleAt:    number
  decisions:  SuiAgentDecision[]
  executed:   number
  blocked:    number
  errors:     string[]
  status:     SuiAgentStatus
}
