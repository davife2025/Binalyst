/**
 * lib/celoAgentLoop.ts — Session K (new file)
 *
 * Shared types & helpers for the Celo Payments Agent loop.
 * Parallel to lib/agentLoop.ts (the BNB competition agent's loop types) but
 * fully independent — no imports from, or by, lib/agentLoop.ts.
 *
 * Hackathon framing: Onchain Agents — Real World Payments & Everyday
 * Applications (Celo). The agent autonomously executes recurring on-chain
 * payments (cUSD / CELO) against a small set of user-defined "payment
 * rules" — e.g. a recurring allowance, subscription, or DCA-style transfer
 * to a savings/treasury address.
 */

import { CELO_AGENT_DEFAULTS } from './celo/config'

export const CELO_LOOP_INTERVAL_MS = CELO_AGENT_DEFAULTS.LOOP_INTERVAL_MS

// ─────────────────────────────────────────────────────────────────────────────
// Payment frequency presets
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_FREQUENCIES = {
  HOURLY: 60 * 60 * 1000,
  DAILY:  24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
} as const

export type PaymentFrequencyKey = keyof typeof PAYMENT_FREQUENCIES

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CeloLoopStatus = 'idle' | 'running' | 'paused' | 'error'

export interface PaymentRule {
  id:           string
  label:        string             // e.g. "Weekly treasury allowance"
  recipient:    string             // 0x... address on Celo
  token:        'cUSD' | 'CELO'
  amount:       number             // amount of `token` per payment
  frequencyMs:  number             // e.g. PAYMENT_FREQUENCIES.DAILY
  lastPaidAt:   number | null
  enabled:      boolean
}

export interface PaymentRecord {
  id:         string
  timestamp:  number
  ruleId:     string
  ruleLabel:  string
  recipient:  string
  token:      'cUSD' | 'CELO'
  amount:     number
  amountUSD:  number
  txHash:     string
  status:     'confirmed' | 'failed' | 'blocked' | 'simulated'
  dryRun:     boolean
  reason?:    string
}

export interface CeloLoopCycleResult {
  cycleAt:      number
  payments:     PaymentRecord[]
  executed:     number   // payments sent (or simulated in dry-run)
  blocked:      number   // guardrail-blocked
  errors:       string[]
  totalUSD:     number
  celoBalance:  number
  cusdBalance:  number
  celoPriceUSD: number
  updatedRules: PaymentRule[]
  status:       CeloLoopStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A rule is "due" if it's enabled and has never run, or its frequency window has elapsed. */
export function isPaymentDue(rule: PaymentRule, now: number = Date.now()): boolean {
  if (!rule.enabled) return false
  if (rule.lastPaidAt === null) return true
  return now - rule.lastPaidAt >= rule.frequencyMs
}

export function nextDueAt(rule: PaymentRule): number | null {
  if (!rule.enabled) return null
  if (rule.lastPaidAt === null) return Date.now()
  return rule.lastPaidAt + rule.frequencyMs
}

export function formatFrequency(ms: number): string {
  if (ms === PAYMENT_FREQUENCIES.HOURLY) return 'Hourly'
  if (ms === PAYMENT_FREQUENCIES.DAILY)  return 'Daily'
  if (ms === PAYMENT_FREQUENCIES.WEEKLY) return 'Weekly'
  const hours = Math.round(ms / (60 * 60 * 1000))
  return `Every ${hours}h`
}

/** Short address display, e.g. 0x1234…abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
