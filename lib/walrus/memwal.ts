/**
 * lib/walrus/memwal.ts
 * MemWal (Walrus Memory) client — Session J.
 *
 * MemWal is the AI agent memory layer built on Walrus.
 * It provides structured, queryable memory for the agent:
 *   - Write: store a memory entry (trade decision, signal snapshot, reasoning)
 *   - Read: recall recent memories by type or symbol
 *
 * Docs: https://docs.memwal.ai/
 * Playground: create an account → get a delegate key for your agent.
 *
 * In Session J, the client is scaffolded with full type safety.
 * In Session L, it is wired into the agent loop to write every
 * decision and signal to verifiable on-chain memory.
 *
 * ISOLATION GUARANTEE: no imports from existing Binalyst lib.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const MEMWAL_BASE = process.env.MEMWAL_API_URL ?? 'https://api.memwal.ai'
const MEMWAL_KEY  = process.env.MEMWAL_API_KEY  ?? ''

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MemWalEntryType =
  | 'signal'          // signal snapshot written each cycle
  | 'decision'        // trade decision (BUY/SELL/HOLD + reasoning)
  | 'trade'           // executed trade record
  | 'cycle_summary'   // full cycle result summary
  | 'strategy_update' // strategy rule change

export interface MemWalEntry {
  id:        string
  type:      MemWalEntryType
  symbol?:   string
  payload:   Record<string, unknown>
  blobId:    string             // Walrus blob ID for the raw data
  timestamp: number
  agentId:   string             // agent wallet address
}

export interface MemWalWriteResult {
  entryId:   string
  blobId:    string
  success:   boolean
  error?:    string
}

export interface MemWalReadResult {
  entries: MemWalEntry[]
  total:   number
  page:    number
}

// ─────────────────────────────────────────────────────────────────────────────
// Write a memory entry
// ─────────────────────────────────────────────────────────────────────────────

export async function memwalWrite(params: {
  agentId:   string
  type:      MemWalEntryType
  symbol?:   string
  payload:   Record<string, unknown>
}): Promise<MemWalWriteResult> {
  if (!MEMWAL_KEY) {
    // No key configured — return a mock result so the agent still runs
    return {
      entryId: `mock-${Date.now()}`,
      blobId:  `mock-blob-${Date.now()}`,
      success: false,
      error:   'MEMWAL_API_KEY not configured — memory write skipped',
    }
  }

  try {
    const res = await fetch(`${MEMWAL_BASE}/v1/memories`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${MEMWAL_KEY}`,
      },
      body: JSON.stringify({
        agent_id: params.agentId,
        type:     params.type,
        symbol:   params.symbol,
        payload:  params.payload,
        timestamp: Date.now(),
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { entryId: '', blobId: '', success: false, error: `MemWal write ${res.status}: ${text}` }
    }

    const json = await res.json() as { id: string; blob_id: string }
    return { entryId: json.id, blobId: json.blob_id, success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { entryId: '', blobId: '', success: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read memory entries
// ─────────────────────────────────────────────────────────────────────────────

export async function memwalRead(params: {
  agentId:  string
  type?:    MemWalEntryType
  symbol?:  string
  limit?:   number
  page?:    number
}): Promise<MemWalReadResult> {
  if (!MEMWAL_KEY) {
    return { entries: [], total: 0, page: 1 }
  }

  const qs = new URLSearchParams({
    agent_id: params.agentId,
    ...(params.type   ? { type: params.type }     : {}),
    ...(params.symbol ? { symbol: params.symbol } : {}),
    limit: String(params.limit ?? 20),
    page:  String(params.page  ?? 1),
  })

  try {
    const res = await fetch(`${MEMWAL_BASE}/v1/memories?${qs}`, {
      headers: { 'Authorization': `Bearer ${MEMWAL_KEY}` },
    })

    if (!res.ok) return { entries: [], total: 0, page: 1 }

    const json = await res.json() as {
      entries: MemWalEntry[]
      total:   number
      page:    number
    }
    return json
  } catch {
    return { entries: [], total: 0, page: 1 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recall latest entry by type (convenience)
// ─────────────────────────────────────────────────────────────────────────────

export async function memwalRecallLatest(
  agentId: string,
  type: MemWalEntryType,
  symbol?: string,
): Promise<MemWalEntry | null> {
  const result = await memwalRead({ agentId, type, symbol, limit: 1, page: 1 })
  return result.entries[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

export async function memwalHealthCheck(): Promise<boolean> {
  if (!MEMWAL_KEY) return false
  try {
    const res = await fetch(`${MEMWAL_BASE}/health`, {
      headers: { 'Authorization': `Bearer ${MEMWAL_KEY}` },
    })
    return res.ok
  } catch {
    return false
  }
}
