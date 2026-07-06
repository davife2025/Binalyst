/**
 * lib/pokt/client.ts — Session P1 (new file)
 *
 * POKTClient — query any supported chain via Pocket Network's
 * decentralised RPC infrastructure (no single point of failure).
 *
 * PURELY ADDITIVE — does not import from or modify any existing Binalyst
 * file. The BNB, Celo, Mantle, and Sui agents are completely untouched.
 *
 * Uses ethers.js v6 JsonRpcProvider (already a project dependency) for
 * EVM chains. Non-EVM chains (Solana) use raw fetch JSON-RPC calls.
 *
 * Architecture:
 *   POKTClient
 *     .getProvider(chainKey)   → ethers JsonRpcProvider pointed at POKT RPC
 *     .getBalance(address)     → native token balance in human-readable units
 *     .getBlock(blockTag)      → latest or specific block data
 *     .getTransaction(hash)    → tx receipt + details
 *     .isContract(address)     → bytecode length check
 *     .getGasPrice()           → current gas price in Gwei
 *     .callERC20Balance()      → ERC-20 token balance via balanceOf()
 *
 * All methods accept an optional chainKey (defaults to 'ethereum').
 * Providers are cached per chain to avoid re-instantiation on every call.
 */

import { ethers } from 'ethers'
import {
  POKT_CHAINS,
  POKT_AGENT_DEFAULTS,
  type POKTChain,
} from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface POKTBalanceResult {
  address:    string
  chainKey:   string
  chainName:  string
  balance:    string        // human-readable, e.g. "1.234"
  balanceWei: string        // raw wei string
  symbol:     string
  via:        'pokt'
}

export interface POKTBlockResult {
  chainKey:    string
  chainName:   string
  number:      number
  hash:        string
  timestamp:   number
  txCount:     number
  gasUsed:     string
  gasLimit:    string
  baseFeeGwei: string | null
  via:         'pokt'
}

export interface POKTTxResult {
  hash:          string
  chainKey:      string
  chainName:     string
  from:          string
  to:            string | null
  valueEth:      string
  gasUsed:       string | null
  status:        'success' | 'failed' | 'pending'
  blockNumber:   number | null
  confirmations: number
  via:           'pokt'
}

export interface POKTContractResult {
  address:    string
  chainKey:   string
  chainName:  string
  isContract: boolean
  codeSize:   number
  via:        'pokt'
}

export interface POKTGasResult {
  chainKey:     string
  chainName:    string
  gasPriceGwei: string
  baseFeeGwei:  string | null
  via:          'pokt'
}

export interface POKTERC20BalanceResult {
  address:       string
  tokenAddress:  string
  chainKey:      string
  chainName:     string
  balance:       string     // human-readable
  balanceRaw:    string
  decimals:      number
  symbol:        string
  via:           'pokt'
}

// ─────────────────────────────────────────────────────────────────────────────
// ERC-20 minimal ABI (balanceOf + decimals + symbol)
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

// ─────────────────────────────────────────────────────────────────────────────
// Provider cache
// ─────────────────────────────────────────────────────────────────────────────

const _providerCache: Map<string, ethers.JsonRpcProvider> = new Map()

function buildRpcUrl(chain: POKTChain): string {
  // POKT public portal — no API key required
  return chain.rpcUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// POKTClient class
// ─────────────────────────────────────────────────────────────────────────────

export class POKTClient {
  private defaultChain: string

  constructor(defaultChain = POKT_AGENT_DEFAULTS.DEFAULT_CHAIN) {
    this.defaultChain = defaultChain
  }

  // ── Provider ──────────────────────────────────────────────────────────────

  getProvider(chainKey?: string): ethers.JsonRpcProvider {
    const key = chainKey ?? this.defaultChain
    const chain = POKT_CHAINS[key]
    if (!chain) throw new Error(`Unknown POKT chain: "${key}"`)
    if (!chain.isEVM) throw new Error(`Chain "${key}" is non-EVM — use rawRPC() instead.`)

    if (!_providerCache.has(key)) {
      const rpcUrl = buildRpcUrl(chain)
      const provider = new ethers.JsonRpcProvider(rpcUrl, chain.chainId ?? undefined)
      _providerCache.set(key, provider)
    }
    return _providerCache.get(key)!
  }

  resolveChain(chainKey?: string): POKTChain {
    const key = chainKey ?? this.defaultChain
    const chain = POKT_CHAINS[key]
    if (!chain) throw new Error(`Unknown POKT chain: "${key}"`)
    return chain
  }

  // ── Native balance ────────────────────────────────────────────────────────

  async getBalance(address: string, chainKey?: string): Promise<POKTBalanceResult> {
    const chain = this.resolveChain(chainKey)
    if (!chain.isEVM) throw new Error(`getBalance not supported for non-EVM chain "${chain.id}"`)

    const provider  = this.getProvider(chain.id)
    const balanceWei = await Promise.race([
      provider.getBalance(address),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), POKT_AGENT_DEFAULTS.RPC_TIMEOUT_MS)
      ),
    ]) as bigint

    return {
      address,
      chainKey:   chain.id,
      chainName:  chain.name,
      balance:    ethers.formatEther(balanceWei),
      balanceWei: balanceWei.toString(),
      symbol:     chain.symbol,
      via:        'pokt',
    }
  }

  // ── Block data ────────────────────────────────────────────────────────────

  async getBlock(
    blockTag: 'latest' | number = 'latest',
    chainKey?: string,
  ): Promise<POKTBlockResult> {
    const chain    = this.resolveChain(chainKey)
    const provider = this.getProvider(chain.id)

    const block = await Promise.race([
      provider.getBlock(blockTag),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), POKT_AGENT_DEFAULTS.RPC_TIMEOUT_MS)
      ),
    ]) as ethers.Block | null

    if (!block) throw new Error(`Block "${blockTag}" not found on ${chain.name}`)

    return {
      chainKey:    chain.id,
      chainName:   chain.name,
      number:      block.number,
      hash:        block.hash ?? '',
      timestamp:   block.timestamp,
      txCount:     block.transactions.length,
      gasUsed:     block.gasUsed.toString(),
      gasLimit:    block.gasLimit.toString(),
      baseFeeGwei: block.baseFeePerGas !== null && block.baseFeePerGas !== undefined
        ? ethers.formatUnits(block.baseFeePerGas, 'gwei')
        : null,
      via: 'pokt',
    }
  }

  // ── Transaction ───────────────────────────────────────────────────────────

  async getTransaction(hash: string, chainKey?: string): Promise<POKTTxResult> {
    const chain    = this.resolveChain(chainKey)
    const provider = this.getProvider(chain.id)

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(hash),
      provider.getTransactionReceipt(hash).catch(() => null),
    ])

    if (!tx) throw new Error(`Transaction "${hash}" not found on ${chain.name}`)

    let status: 'success' | 'failed' | 'pending' = 'pending'
    if (receipt) {
      status = receipt.status === 1 ? 'success' : 'failed'
    }

    const currentBlock = await provider.getBlockNumber()

    return {
      hash:          tx.hash,
      chainKey:      chain.id,
      chainName:     chain.name,
      from:          tx.from,
      to:            tx.to,
      valueEth:      ethers.formatEther(tx.value),
      gasUsed:       receipt ? receipt.gasUsed.toString() : null,
      status,
      blockNumber:   tx.blockNumber,
      confirmations: tx.blockNumber ? currentBlock - tx.blockNumber : 0,
      via:           'pokt',
    }
  }

  // ── Contract detection ────────────────────────────────────────────────────

  async isContract(address: string, chainKey?: string): Promise<POKTContractResult> {
    const chain    = this.resolveChain(chainKey)
    const provider = this.getProvider(chain.id)

    const code     = await provider.getCode(address)
    const codeSize = code === '0x' ? 0 : (code.length - 2) / 2  // bytes

    return {
      address,
      chainKey:   chain.id,
      chainName:  chain.name,
      isContract: codeSize > 0,
      codeSize,
      via:        'pokt',
    }
  }

  // ── Gas price ─────────────────────────────────────────────────────────────

  async getGasPrice(chainKey?: string): Promise<POKTGasResult> {
    const chain    = this.resolveChain(chainKey)
    const provider = this.getProvider(chain.id)

    const feeData = await provider.getFeeData()

    return {
      chainKey:     chain.id,
      chainName:    chain.name,
      gasPriceGwei: feeData.gasPrice
        ? ethers.formatUnits(feeData.gasPrice, 'gwei')
        : '0',
      baseFeeGwei: feeData.maxFeePerGas
        ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei')
        : null,
      via: 'pokt',
    }
  }

  // ── ERC-20 token balance ──────────────────────────────────────────────────

  async getERC20Balance(
    walletAddress: string,
    tokenAddress:  string,
    chainKey?:     string,
  ): Promise<POKTERC20BalanceResult> {
    const chain    = this.resolveChain(chainKey)
    const provider = this.getProvider(chain.id)

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)

    const [balanceRaw, decimals, symbol] = await Promise.all([
      contract.balanceOf(walletAddress) as Promise<bigint>,
      contract.decimals()               as Promise<number>,
      contract.symbol()                 as Promise<string>,
    ])

    return {
      address:      walletAddress,
      tokenAddress,
      chainKey:     chain.id,
      chainName:    chain.name,
      balance:      ethers.formatUnits(balanceRaw, decimals),
      balanceRaw:   balanceRaw.toString(),
      decimals:     Number(decimals),
      symbol,
      via:          'pokt',
    }
  }

  // ── Solana raw JSON-RPC (non-EVM) ────────────────────────────────────────

  async solanaCall(method: string, params: unknown[] = []): Promise<unknown> {
    const chain  = POKT_CHAINS.solana
    const rpcUrl = buildRpcUrl(chain)

    const res = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal:  AbortSignal.timeout(POKT_AGENT_DEFAULTS.RPC_TIMEOUT_MS),
    })

    if (!res.ok) throw new Error(`Solana POKT RPC error: ${res.status}`)
    const data = await res.json() as { result?: unknown; error?: { message: string } }
    if (data.error) throw new Error(`Solana RPC error: ${data.error.message}`)
    return data.result
  }

  async getSolanaBalance(address: string): Promise<{ address: string; balanceLamports: number; balanceSOL: string }> {
    const result = await this.solanaCall('getBalance', [address]) as { value: number }
    const lamports = result?.value ?? 0
    return {
      address,
      balanceLamports: lamports,
      balanceSOL:      (lamports / 1e9).toFixed(9),
    }
  }

  async getSolanaLatestSlot(): Promise<number> {
    return await this.solanaCall('getSlot', []) as number
  }

  // ── Health ping ───────────────────────────────────────────────────────────

  async pingChain(chainKey: string): Promise<{ chainKey: string; ok: boolean; latencyMs: number; blockNumber?: number }> {
    const t0 = Date.now()
    try {
      const chain = POKT_CHAINS[chainKey]
      if (!chain) return { chainKey, ok: false, latencyMs: 0 }

      let blockNumber: number | undefined
      if (chain.isEVM) {
        const provider = this.getProvider(chainKey)
        blockNumber = await Promise.race([
          provider.getBlockNumber(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as number
      } else if (chainKey === 'solana') {
        blockNumber = await this.getSolanaLatestSlot()
      }

      return { chainKey, ok: true, latencyMs: Date.now() - t0, blockNumber }
    } catch {
      return { chainKey, ok: false, latencyMs: Date.now() - t0 }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — module-level default client
// ─────────────────────────────────────────────────────────────────────────────

export const poktClient = new POKTClient()
