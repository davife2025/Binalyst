/**
 * lib/movePolicy/client.ts
 * Move policy object client — Session K.
 *
 * A Move policy object is a Sui smart-contract object that encodes
 * the agent's spending rules on-chain:
 *   - Budget cap (max USDC the agent can spend total)
 *   - Per-trade limit (max per single transaction)
 *   - Allowed protocols (DeepBook pool IDs only)
 *   - Expiry epoch (auto-revokes after N Sui epochs)
 *   - Owner address (the only address that can revoke)
 *
 * Session K: scaffolds the policy type + PTB construction helpers.
 * The actual Move package will be deployed in Session K's API route.
 *
 * ISOLATION GUARANTEE: no imports from any existing Binalyst lib.
 */

import type { SuiNetwork } from '../sui/client'
import { SUI_NETWORKS }    from '../sui/client'

// ─────────────────────────────────────────────────────────────────────────────
// Policy types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentPolicy {
  /** On-chain object ID of the policy (set after creation) */
  objectId:         string | null
  /** Owner address — the only one who can revoke */
  ownerAddress:     string
  /** Agent wallet address — the one executing trades */
  agentAddress:     string
  /** Total budget cap in USD cents (e.g. 50000 = $500.00) */
  budgetCapCents:   number
  /** Max per single trade in USD cents */
  perTradeLimitCents: number
  /** Allowed DeepBook pool IDs (empty = all pools) */
  allowedPools:     string[]
  /** Sui epoch the policy expires (null = no expiry) */
  expiryEpoch:      number | null
  /** Current spend in USD cents (tracked on-chain) */
  spentCents:       number
  /** Whether policy has been revoked */
  revoked:          boolean
  /** Network this policy lives on */
  network:          SuiNetwork
  /** ISO timestamp of creation */
  createdAt:        string | null
  /** Transaction digest of creation tx */
  creationTxDigest: string | null
}

export const DEFAULT_POLICY: Omit<AgentPolicy, 'ownerAddress' | 'agentAddress'> = {
  objectId:            null,
  budgetCapCents:      50000,    // $500 default cap
  perTradeLimitCents:  5000,     // $50 per trade
  allowedPools:        [],       // all pools
  expiryEpoch:         null,
  spentCents:          0,
  revoked:             false,
  network:             'testnet',
  createdAt:           null,
  creationTxDigest:    null,
}

export interface PolicyCreateParams {
  ownerAddress:        string
  agentAddress:        string
  budgetCapCents:      number
  perTradeLimitCents:  number
  allowedPools?:       string[]
  expiryEpoch?:        number
  network:             SuiNetwork
}

export interface PolicyCheckResult {
  allowed:     boolean
  reason?:     string
  remaining:   number    // remaining budget in cents
  warningPct?: number    // % of budget used (if > 80)
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy enforcement (client-side mirror of on-chain logic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether a proposed trade is allowed under the current policy.
 * This mirrors the on-chain Move check — used for pre-flight UI validation.
 */
export function checkPolicyAllowsTrade(
  policy: AgentPolicy,
  params: {
    amountCents: number
    poolId?:     string
    currentEpoch?: number
  },
): PolicyCheckResult {
  if (policy.revoked) {
    return { allowed: false, reason: 'Policy has been revoked by owner', remaining: 0 }
  }

  if (policy.expiryEpoch !== null && params.currentEpoch !== undefined) {
    if (params.currentEpoch >= policy.expiryEpoch) {
      return { allowed: false, reason: `Policy expired at epoch ${policy.expiryEpoch}`, remaining: 0 }
    }
  }

  if (params.amountCents > policy.perTradeLimitCents) {
    return {
      allowed: false,
      reason: `Trade $${(params.amountCents / 100).toFixed(2)} exceeds per-trade limit $${(policy.perTradeLimitCents / 100).toFixed(2)}`,
      remaining: policy.budgetCapCents - policy.spentCents,
    }
  }

  const remaining = policy.budgetCapCents - policy.spentCents
  if (params.amountCents > remaining) {
    return {
      allowed: false,
      reason: `Insufficient budget — $${(remaining / 100).toFixed(2)} remaining, trade needs $${(params.amountCents / 100).toFixed(2)}`,
      remaining,
    }
  }

  if (policy.allowedPools.length > 0 && params.poolId) {
    if (!policy.allowedPools.includes(params.poolId)) {
      return {
        allowed: false,
        reason: `Pool ${params.poolId} not in allowed list`,
        remaining,
      }
    }
  }

  const usedPct = ((policy.spentCents + params.amountCents) / policy.budgetCapCents) * 100

  return {
    allowed:    true,
    remaining:  remaining - params.amountCents,
    warningPct: usedPct > 80 ? usedPct : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PTB (Programmable Transaction Block) builders
// These construct the transaction payloads sent to the Sui RPC.
// Session K uses the Sui JSON-RPC directly (no SDK needed).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the PTB payload to create a new policy object on-chain.
 * In production this calls the deployed Move package's `create_policy` entry fn.
 */
export function buildCreatePolicyTx(params: PolicyCreateParams): {
  kind:      'programmableTransaction'
  inputs:    unknown[]
  commands:  unknown[]
  network:   SuiNetwork
  rpcUrl:    string
} {
  const rpcUrl = SUI_NETWORKS[params.network]

  // MoveCall to binalyst_policy::agent_policy::create_policy
  // Package address is set at deploy time (Session K API route stores it in env)
  const PACKAGE_ID = process.env.NEXT_PUBLIC_POLICY_PACKAGE_ID ?? '0x0'

  return {
    kind: 'programmableTransaction',
    inputs: [
      { type: 'pure', valueType: 'address',  value: params.agentAddress },
      { type: 'pure', valueType: 'u64',      value: params.budgetCapCents },
      { type: 'pure', valueType: 'u64',      value: params.perTradeLimitCents },
      { type: 'pure', valueType: 'u64',      value: params.expiryEpoch ?? 0 },
    ],
    commands: [
      {
        MoveCall: {
          package:  PACKAGE_ID,
          module:   'agent_policy',
          function: 'create_policy',
          typeArguments: [],
          arguments: [
            { Input: 0 },
            { Input: 1 },
            { Input: 2 },
            { Input: 3 },
          ],
        },
      },
    ],
    network: params.network,
    rpcUrl,
  }
}

/**
 * Build the PTB payload to revoke a policy object on-chain.
 * Only the owner can call this.
 */
export function buildRevokePolicyTx(params: {
  policyObjectId: string
  network:        SuiNetwork
}): {
  kind:     'programmableTransaction'
  inputs:   unknown[]
  commands: unknown[]
  network:  SuiNetwork
  rpcUrl:   string
} {
  const PACKAGE_ID = process.env.NEXT_PUBLIC_POLICY_PACKAGE_ID ?? '0x0'
  const rpcUrl     = SUI_NETWORKS[params.network]

  return {
    kind: 'programmableTransaction',
    inputs: [
      { type: 'object', objectId: params.policyObjectId },
    ],
    commands: [
      {
        MoveCall: {
          package:  PACKAGE_ID,
          module:   'agent_policy',
          function: 'revoke_policy',
          typeArguments: [],
          arguments: [{ Input: 0 }],
        },
      },
    ],
    network: params.network,
    rpcUrl,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatBudget(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function budgetUsedPct(policy: AgentPolicy): number {
  if (policy.budgetCapCents <= 0) return 0
  return Math.min(100, (policy.spentCents / policy.budgetCapCents) * 100)
}

export function policyStatusLabel(policy: AgentPolicy): {
  label: string
  color: 'green' | 'yellow' | 'red' | 'gray'
} {
  if (policy.revoked)      return { label: 'Revoked',  color: 'red'    }
  if (!policy.objectId)    return { label: 'Not deployed', color: 'gray' }
  const usedPct = budgetUsedPct(policy)
  if (usedPct >= 100)      return { label: 'Budget exhausted', color: 'red'    }
  if (usedPct >= 80)       return { label: 'Budget warning',   color: 'yellow' }
  return                          { label: 'Active',           color: 'green'  }
}
