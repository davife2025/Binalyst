/**
 * lib/sui/client.ts
 * Sui blockchain client — Session J.
 *
 * Provides wallet connection, SUI balance fetch, and signed
 * transaction helpers for the parallel Sui agent module.
 *
 * ISOLATION GUARANTEE: nothing in this file imports from any
 * existing Binalyst lib. It is a fully self-contained module.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const SUI_NETWORKS = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet:  'https://fullnode.devnet.sui.io',
} as const

export type SuiNetwork = keyof typeof SUI_NETWORKS

export const DEFAULT_NETWORK: SuiNetwork = 'testnet'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiWalletInfo {
  address:     string
  network:     SuiNetwork
  balanceSUI:  number       // human-readable SUI (not MIST)
  balanceMIST: bigint
  connectedAt: number
}

export interface SuiTxResult {
  success:   boolean
  digest?:   string          // transaction digest (on-chain ID)
  error?:    string
  gasUsed?:  number
}

export interface SuiObjectRef {
  objectId:        string
  version:         string
  digest:          string
}

// ─────────────────────────────────────────────────────────────────────────────
// RPC helpers (raw JSON-RPC — no SDK dependency needed for Session J)
// ─────────────────────────────────────────────────────────────────────────────

async function suiRpc(
  network: SuiNetwork,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const url = SUI_NETWORKS[network]
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id:      1,
      method,
      params,
    }),
  })

  if (!res.ok) {
    throw new Error(`Sui RPC HTTP ${res.status}: ${res.statusText}`)
  }

  const json = await res.json() as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(`Sui RPC error: ${json.error.message}`)
  return json.result
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance
// ─────────────────────────────────────────────────────────────────────────────

const MIST_PER_SUI = 1_000_000_000n

/**
 * Fetch the SUI coin balance for an address.
 * Returns both raw MIST and human-readable SUI.
 */
export async function getSuiBalance(
  address: string,
  network: SuiNetwork = DEFAULT_NETWORK,
): Promise<{ balanceSUI: number; balanceMIST: bigint }> {
  const result = await suiRpc(network, 'suix_getBalance', [
    address,
    '0x2::sui::SUI',
  ]) as { totalBalance: string }

  const balanceMIST = BigInt(result.totalBalance ?? '0')
  const balanceSUI  = Number(balanceMIST) / Number(MIST_PER_SUI)

  return { balanceSUI, balanceMIST }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owned objects
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiOwnedObject {
  objectId:  string
  version:   string
  digest:    string
  type?:     string
}

export async function getOwnedObjects(
  address: string,
  network: SuiNetwork = DEFAULT_NETWORK,
  limit = 20,
): Promise<SuiOwnedObject[]> {
  const result = await suiRpc(network, 'suix_getOwnedObjects', [
    address,
    { options: { showType: true } },
    null,
    limit,
  ]) as { data: Array<{ data: SuiOwnedObject }> }

  return (result.data ?? []).map(d => d.data)
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction status
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiTxStatus {
  digest:        string
  status:        'success' | 'failure'
  gasUsed:       number
  timestampMs?:  number
  errors?:       string[]
}

export async function getTxStatus(
  digest: string,
  network: SuiNetwork = DEFAULT_NETWORK,
): Promise<SuiTxStatus> {
  const result = await suiRpc(network, 'sui_getTransactionBlock', [
    digest,
    { showEffects: true, showInput: false },
  ]) as {
    digest: string
    effects: {
      status: { status: 'success' | 'failure'; error?: string }
      gasUsed: { computationCost: string; storageCost: string; storageRebate: string }
    }
    timestampMs?: string
  }

  const gas =
    Number(result.effects.gasUsed.computationCost) +
    Number(result.effects.gasUsed.storageCost) -
    Number(result.effects.gasUsed.storageRebate)

  return {
    digest,
    status:       result.effects.status.status,
    gasUsed:      gas,
    timestampMs:  result.timestampMs ? Number(result.timestampMs) : undefined,
    errors:       result.effects.status.error ? [result.effects.status.error] : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Address validation
// ─────────────────────────────────────────────────────────────────────────────

export function isValidSuiAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(addr)
}

export function shortenAddress(addr: string, chars = 6): string {
  if (!addr || addr.length < chars * 2 + 2) return addr
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Explorer links
// ─────────────────────────────────────────────────────────────────────────────

export function explorerTxUrl(digest: string, network: SuiNetwork): string {
  const net = network === 'mainnet' ? '' : `?network=${network}`
  return `https://suiscan.xyz/${network}/tx/${digest}`
}

export function explorerAddressUrl(address: string, network: SuiNetwork): string {
  return `https://suiscan.xyz/${network}/account/${address}`
}
