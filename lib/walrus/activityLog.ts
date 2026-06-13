/**
 * lib/walrus/activityLog.ts
 * On-chain activity log via Walrus — Session L.
 *
 * Every agent decision (trade placed, blocked, or dry-run) is written
 * to Walrus as an immutable blob. The blobId becomes the permanent
 * verifiable proof of the agent's action — satisfying the hackathon's
 * "on-chain activity log" requirement.
 *
 * Each log entry is a structured JSON object stored as a Walrus blob.
 * The blobId is stored back on the DeepBookOrder and SuiAgentDecision
 * records so judges can independently verify every action.
 *
 * ISOLATION GUARANTEE: no imports from any existing Binalyst lib.
 */

import { walrusStoreJson, walrusRetrieveJson, walrusBlobUrl } from './client'
import type { WalrusNetwork }     from './client'
import type { DeepBookOrder }     from '../deepbook/types'
import type { SuiAgentDecision }  from '../sui/types'

// ─────────────────────────────────────────────────────────────────────────────
// Log entry schema
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityEntryType =
  | 'order_placed'
  | 'order_blocked'
  | 'order_dry_run'
  | 'order_cancelled'
  | 'order_filled'
  | 'policy_created'
  | 'policy_revoked'
  | 'cycle_summary'
  | 'agent_started'
  | 'agent_stopped'

export interface ActivityLogEntry {
  /** Schema version — bump if shape changes */
  version:       1
  /** Entry type */
  type:          ActivityEntryType
  /** Sui network */
  network:       string
  /** Agent wallet address */
  agentAddress:  string | null
  /** Unix timestamp ms */
  timestamp:     number
  /** ISO timestamp */
  isoTime:       string
  /** Human-readable summary */
  summary:       string
  /** Full structured payload */
  payload:       Record<string, unknown>
  /** Walrus blob URL (self-referential, set after store) */
  blobUrl?:      string
}

export interface ActivityLogResult {
  blobId:   string
  blobUrl:  string
  entry:    ActivityLogEntry
  success:  boolean
  error?:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Write helpers
// ─────────────────────────────────────────────────────────────────────────────

const WALRUS_NETWORK: WalrusNetwork = 'testnet'

/**
 * Log a DeepBook order placement to Walrus.
 * Returns the blobId which should be stored on the order record.
 */
export async function logOrderPlaced(
  order: DeepBookOrder,
  agentAddress: string | null,
): Promise<ActivityLogResult> {
  const entry: ActivityLogEntry = {
    version:      1,
    type:         order.dryRun ? 'order_dry_run' : 'order_placed',
    network:      order.network,
    agentAddress,
    timestamp:    order.placedAt,
    isoTime:      new Date(order.placedAt).toISOString(),
    summary:      `${order.dryRun ? '[DRY RUN] ' : ''}${order.side === 'bid' ? 'BUY' : 'SELL'} ${order.quantity} ${order.pair} @ ${order.price.toFixed(4)}`,
    payload: {
      clientOrderId:  order.clientOrderId,
      orderId:        order.orderId,
      poolId:         order.poolId,
      pair:           order.pair,
      side:           order.side,
      type:           order.type,
      price:          order.price,
      quantity:       order.quantity,
      filledQty:      order.filledQty,
      status:         order.status,
      txDigest:       order.txDigest,
      dryRun:         order.dryRun,
      agentReasoning: order.agentReasoning,
      signalScore:    order.signalScore,
    },
  }

  return writeEntry(entry)
}

/**
 * Log a blocked agent decision to Walrus.
 */
export async function logOrderBlocked(
  decision: SuiAgentDecision,
  agentAddress: string | null,
  network: string,
): Promise<ActivityLogResult> {
  const entry: ActivityLogEntry = {
    version:      1,
    type:         'order_blocked',
    network,
    agentAddress,
    timestamp:    decision.timestamp,
    isoTime:      new Date(decision.timestamp).toISOString(),
    summary:      `BLOCKED ${decision.action} ${decision.symbol}: ${decision.blockReason ?? 'unknown reason'}`,
    payload: {
      symbol:       decision.symbol,
      action:       decision.action,
      amountUSD:    decision.amountUSD,
      signalScore:  decision.signalScore,
      reasoning:    decision.reasoning,
      blockReason:  decision.blockReason,
    },
  }

  return writeEntry(entry)
}

/**
 * Log a policy event (creation or revocation).
 */
export async function logPolicyEvent(params: {
  type:          'policy_created' | 'policy_revoked'
  policyObjectId: string
  ownerAddress:  string
  agentAddress:  string
  network:       string
  txDigest?:     string
  budgetCapCents?: number
}): Promise<ActivityLogResult> {
  const entry: ActivityLogEntry = {
    version:      1,
    type:         params.type,
    network:      params.network,
    agentAddress: params.agentAddress,
    timestamp:    Date.now(),
    isoTime:      new Date().toISOString(),
    summary:      `Policy ${params.type === 'policy_created' ? 'created' : 'REVOKED'} — object ${params.policyObjectId.slice(0, 16)}…`,
    payload: {
      policyObjectId: params.policyObjectId,
      ownerAddress:   params.ownerAddress,
      agentAddress:   params.agentAddress,
      txDigest:       params.txDigest,
      budgetCapCents: params.budgetCapCents,
    },
  }

  return writeEntry(entry)
}

/**
 * Log a cycle summary (fired at end of each agent cycle).
 */
export async function logCycleSummary(params: {
  cycleAt:      number
  cycleCount:   number
  executed:     number
  blocked:      number
  errors:       string[]
  agentAddress: string | null
  network:      string
}): Promise<ActivityLogResult> {
  const entry: ActivityLogEntry = {
    version:      1,
    type:         'cycle_summary',
    network:      params.network,
    agentAddress: params.agentAddress,
    timestamp:    params.cycleAt,
    isoTime:      new Date(params.cycleAt).toISOString(),
    summary:      `Cycle #${params.cycleCount}: ${params.executed} executed, ${params.blocked} blocked`,
    payload: {
      cycleCount: params.cycleCount,
      executed:   params.executed,
      blocked:    params.blocked,
      errors:     params.errors,
    },
  }

  return writeEntry(entry)
}

// ─────────────────────────────────────────────────────────────────────────────
// Core write
// ─────────────────────────────────────────────────────────────────────────────

async function writeEntry(entry: ActivityLogEntry): Promise<ActivityLogResult> {
  try {
    const result  = await walrusStoreJson(entry, { network: WALRUS_NETWORK, epochs: 10 })
    const blobUrl = walrusBlobUrl(result.blobId, WALRUS_NETWORK)

    return {
      blobId:  result.blobId,
      blobUrl,
      entry:   { ...entry, blobUrl },
      success: true,
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    return {
      blobId:  '',
      blobUrl: '',
      entry,
      success: false,
      error,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function readLogEntry(blobId: string): Promise<ActivityLogEntry | null> {
  const result = await walrusRetrieveJson<ActivityLogEntry>(blobId, WALRUS_NETWORK)
  return result.data
}

export function formatLogEntry(entry: ActivityLogEntry): string {
  return `[${entry.isoTime}] ${entry.type.toUpperCase()} — ${entry.summary}`
}
