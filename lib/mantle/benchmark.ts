/**
 * lib/mantle/benchmark.ts — Session N2 · ETHERS-FIX
 * Fixed: ethers v5 → v6 API (utils.* → top-level, constants.Zero → 0n)
 *
 * On-chain benchmarking for The Turing Test Hackathon.
 * Defining feature #1: "Every agent decision and outcome is recorded on
 * Mantle, creating a permanent, decentralised record of AI performance —
 * the first of its kind in Web3."
 *
 * Implementation approach — zero-value data transactions:
 * Each agent decision is encoded as compact JSON in the `data` field of
 * a zero-value MNT transaction sent to a known benchmark sink address.
 * This requires no smart contract deployment, uses only gas (MNT), and
 * creates permanently indexed, queryable records on Mantle.
 *
 * Records are queryable via Mantle explorer:
 *   https://explorer.mantle.xyz/address/BENCHMARK_SINK_ADDRESS
 *
 * Alternative (N3+ stretch): emit records through a minimal on-chain
 * event emitter contract for better queryability via `eth_getLogs`.
 *
 * This file is entirely new and imports only from Session N1 files.
 */

import { ethers }           from 'ethers'
import { MantleClient }     from './client'
import {
  BENCHMARK_SINK_ADDRESS,
  MANTLE_EXPLORER_TX,
  type MantleNetwork,
} from './config'
import type { BenchmarkRecord } from '../mantleAgentLoop'
import { encodeBenchmarkRecord } from '../mantleAgentLoop'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BenchmarkWriteResult {
  success:    boolean
  txHash?:    string
  explorerUrl?: string
  gasUsed?:   number
  error?:     string
  skipped?:   boolean   // true when dryRun=true or wallet not loaded
}

// ─────────────────────────────────────────────────────────────────────────────
// Write a benchmark record on-chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a BenchmarkRecord to Mantle as a zero-value data transaction.
 * In dry-run mode or when no wallet is loaded, returns skipped=true
 * (no on-chain write) so the agent loop can still function.
 */
export async function writeBenchmarkRecord(
  client:  MantleClient,
  record:  BenchmarkRecord,
  dryRun:  boolean = true,
): Promise<BenchmarkWriteResult> {
  // Always skip in dry-run — no gas spent for simulation cycles
  if (dryRun) {
    return { success: true, skipped: true }
  }

  const wallet = client.getWallet()
  if (!wallet) {
    return { success: true, skipped: true }
  }
  try {
    const encoded = encodeBenchmarkRecord(record)
    const data    = ethers.hexlify(ethers.toUtf8Bytes(encoded))

    const tx = await wallet.sendTransaction({
      to:    BENCHMARK_SINK_ADDRESS,
      value: 0n,
      data,
      // Explicit gas limit — data transactions cost ~21000 + 16 per byte
      gasLimit: 50_000,
    })

    const receipt = await tx.wait(1)
    if (!receipt) {
      return { success: false, error: 'Transaction receipt is null' }
    }

    return {
      success:     true,
      txHash:      receipt.hash, // ← v6 syntax
      explorerUrl: MANTLE_EXPLORER_TX(receipt.hash, client.network), // ← v6 syntax
      gasUsed:     receipt.gasUsed ? Number(receipt.gasUsed) : undefined,
    }
  } catch (e: any) {
    // ← THIS WAS MISSING!
    return {
      success: false,
      error:   e.message || 'Failed to write benchmark record',
    }
  }
} // ← THIS WAS MISSING! It closes the writeBenchmarkRecord function.
  
// ─────────────────────────────────────────────────────────────────────────────
// Batch write (for end-of-session flush)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write multiple benchmark records sequentially.
 * Stops on first hard failure (e.g. out of gas), returns partial results.
 */
export async function writeBenchmarkBatch(
  client:  MantleClient,
  records: BenchmarkRecord[],
  dryRun:  boolean = true,
): Promise<BenchmarkWriteResult[]> {
  const results: BenchmarkWriteResult[] = []

  for (const record of records) {
    const result = await writeBenchmarkRecord(client, record, dryRun)
    results.push(result)

    // Stop if we hit a real error (not just a skip)
    if (!result.success && !result.skipped) break
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Query benchmark records (read-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch recent benchmark records from Mantle RPC by scanning transactions
 * sent to the benchmark sink address from the given agent.
 *
 * NOTE: This uses eth_getTransactionCount + a block scan heuristic.
 * For production use, index the sink address via Mantle explorer API or
 * a subgraph. This implementation is intentionally simple for demo/hackathon.
 */
export async function fetchBenchmarkRecords(
  agentAddress: string,
  network:      MantleNetwork = 'mainnet',
  limit:        number = 20,
): Promise<BenchmarkRecord[]> {
  // This is a stub for the hackathon demo — in production, use the
  // Mantle explorer API: https://explorer.mantle.xyz/api
  // For now, records are read from the local store (mantleAgentStore.ts)
  // which persists the last 200 benchmarks in localStorage.
  console.log(`[benchmark] fetchBenchmarkRecords stub: ${agentAddress} on ${network} (limit ${limit})`)
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Estimate gas cost for a single benchmark write (in MNT). */
export function estimateBenchmarkGasCost(
  mntPriceUSD: number,
  gasPriceGwei: number = 0.02,  // Mantle is very cheap — ~0.02 gwei typical
): number {
  const gasUnits    = 50_000
  const costInMNT   = (gasUnits * gasPriceGwei * 1e-9)
  const costInUSD   = costInMNT * mntPriceUSD
  return costInUSD
}

/** Build a benchmark sink explorer URL. */
export function benchmarkSinkUrl(network: MantleNetwork = 'mainnet'): string {
  const base = network === 'mainnet'
    ? 'https://explorer.mantle.xyz'
    : 'https://explorer.sepolia.mantle.xyz'
  return `${base}/address/${BENCHMARK_SINK_ADDRESS}`
}