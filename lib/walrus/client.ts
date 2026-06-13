/**
 * lib/walrus/client.ts
 * Walrus decentralized storage client — Session J.
 *
 * Provides store/retrieve for agent memory blobs using the
 * Walrus HTTP API (public aggregators + publishers).
 *
 * Docs: https://docs.wal.app/docs/http-api/storing-blobs
 *
 * ISOLATION GUARANTEE: no imports from existing Binalyst lib.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

// Public Walrus aggregator (read) and publisher (write) endpoints
// These are the official testnet public nodes from the Walrus docs.
export const WALRUS_ENDPOINTS = {
  testnet: {
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
    publisher:  'https://publisher.walrus-testnet.walrus.space',
  },
  mainnet: {
    aggregator: 'https://aggregator.walrus.space',
    publisher:  'https://publisher.walrus.space',
  },
} as const

export type WalrusNetwork = keyof typeof WALRUS_ENDPOINTS

export const DEFAULT_WALRUS_NETWORK: WalrusNetwork = 'testnet'

// Epochs to store data (1 epoch ≈ 1 day on testnet)
export const DEFAULT_EPOCHS = 10

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WalrusStoreResult {
  blobId:       string
  suiObjectId?: string       // on-chain certificate object ID
  cost?:        number       // WAL tokens spent
  alreadyExists: boolean     // true if blob was already stored (deduped)
  endEpoch?:    number
}

export interface WalrusRetrieveResult {
  blobId:  string
  data:    string            // UTF-8 decoded content
  found:   boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Store a blob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store arbitrary UTF-8 content on Walrus.
 * Returns the blobId which is the permanent retrieval key.
 *
 * For Session J this uses the public publisher (no WAL tokens needed on testnet
 * for small blobs). Session L will add authenticated writes via MemWal.
 */
export async function walrusStore(
  content: string,
  options: {
    network?: WalrusNetwork
    epochs?:  number
  } = {},
): Promise<WalrusStoreResult> {
  const network  = options.network ?? DEFAULT_WALRUS_NETWORK
  const epochs   = options.epochs  ?? DEFAULT_EPOCHS
  const endpoint = WALRUS_ENDPOINTS[network]

  const body = new TextEncoder().encode(content)

  const res = await fetch(
    `${endpoint.publisher}/v1/blobs?epochs=${epochs}`,
    {
      method:  'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Walrus store failed (${res.status}): ${text}`)
  }

  const json = await res.json() as {
    newlyCreated?: {
      blobObject: {
        blobId:    string
        id:        string
        storageCost: number
        endEpoch:  number
      }
    }
    alreadyCertified?: {
      blobId:   string
      endEpoch: number
    }
  }

  if (json.alreadyCertified) {
    return {
      blobId:        json.alreadyCertified.blobId,
      alreadyExists: true,
      endEpoch:      json.alreadyCertified.endEpoch,
    }
  }

  if (json.newlyCreated) {
    return {
      blobId:        json.newlyCreated.blobObject.blobId,
      suiObjectId:   json.newlyCreated.blobObject.id,
      cost:          json.newlyCreated.blobObject.storageCost,
      alreadyExists: false,
      endEpoch:      json.newlyCreated.blobObject.endEpoch,
    }
  }

  throw new Error('Walrus store: unexpected response shape')
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieve a blob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve a blob by its blobId from Walrus.
 * Returns the decoded UTF-8 string content.
 */
export async function walrusRetrieve(
  blobId: string,
  network: WalrusNetwork = DEFAULT_WALRUS_NETWORK,
): Promise<WalrusRetrieveResult> {
  const endpoint = WALRUS_ENDPOINTS[network]

  const res = await fetch(`${endpoint.aggregator}/v1/blobs/${blobId}`)

  if (res.status === 404) {
    return { blobId, data: '', found: false }
  }

  if (!res.ok) {
    throw new Error(`Walrus retrieve failed (${res.status})`)
  }

  const buffer = await res.arrayBuffer()
  const data   = new TextDecoder().decode(buffer)

  return { blobId, data, found: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store JSON (convenience wrapper)
// ─────────────────────────────────────────────────────────────────────────────

export async function walrusStoreJson<T>(
  payload: T,
  options: { network?: WalrusNetwork; epochs?: number } = {},
): Promise<WalrusStoreResult> {
  return walrusStore(JSON.stringify(payload, null, 2), options)
}

export async function walrusRetrieveJson<T>(
  blobId: string,
  network: WalrusNetwork = DEFAULT_WALRUS_NETWORK,
): Promise<{ data: T | null; found: boolean }> {
  const result = await walrusRetrieve(blobId, network)
  if (!result.found || !result.data) return { data: null, found: false }
  try {
    return { data: JSON.parse(result.data) as T, found: true }
  } catch {
    return { data: null, found: false }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blob URL helpers
// ─────────────────────────────────────────────────────────────────────────────

export function walrusBlobUrl(blobId: string, network: WalrusNetwork = DEFAULT_WALRUS_NETWORK): string {
  return `${WALRUS_ENDPOINTS[network].aggregator}/v1/blobs/${blobId}`
}

export function walrusSuiScanUrl(blobId: string): string {
  return `https://suiscan.xyz/testnet/object/${blobId}`
}
