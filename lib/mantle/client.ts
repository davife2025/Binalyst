/**
 * lib/mantle/client.ts — Session N1 (new file)
 *
 * MantleClient — execution layer for the Mantle AI Trading Agent.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * Mirrors the structure of lib/celo/client.ts (CeloClient) and
 * lib/twak/client.ts (TWAKClient) but is fully independent of both.
 * Nothing here is imported by, or imports from, any existing Binalyst file.
 *
 * Responsibilities:
 *  - Wallet generation / import / encryption
 *  - MNT native balance + ERC-20 token balances (mETH, USDY, USDC, USDT)
 *  - Portfolio USD valuation (using Bybit prices from lib/bybit.ts)
 *  - ERC-20 token transfers (for settlement)
 *  - Trade guardrails (balance, drawdown, daily cap, dust floor)
 *  - Swap routing stub (Merchant Moe / Agni — wired in N2)
 */

import { ethers } from 'ethers'
import {
  MantleNetwork,
  MANTLE_RPC,
  MANTLE_RPC_BACKUP,
  MANTLE_CHAIN_ID,
  MANTLE_TOKENS,
  MANTLE_AGENT_RULES,
  type MantleTokenInfo,
} from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeGuardrailParams {
  symbol:         string          // token being traded, e.g. 'MNT'
  network:        MantleNetwork
  tradeAmountUSD: number          // USD value of proposed trade
  portfolioUSD:   number          // total portfolio USD value
  mntBalance:     number          // current MNT (gas token) balance
  drawdownPct:    number          // current drawdown % (positive = drawdown)
  tradesToday:    number          // trades executed today
}

export interface GuardrailResult {
  allowed: boolean
  reason?: string
}

export function checkTradeGuardrails(params: TradeGuardrailParams): GuardrailResult {
  const {
    symbol, network, tradeAmountUSD, portfolioUSD,
    mntBalance, drawdownPct, tradesToday,
  } = params

  // 1. Token must exist on this network
  if (!MANTLE_TOKENS[network][symbol]) {
    return { allowed: false, reason: `${symbol} is not a configured token on Mantle ${network}.` }
  }

  // 2. Must keep MNT gas reserve
  if (mntBalance < MANTLE_AGENT_RULES.MIN_MNT_GAS_RESERVE) {
    return {
      allowed: false,
      reason: `MNT balance ${mntBalance.toFixed(4)} is below gas reserve of ${MANTLE_AGENT_RULES.MIN_MNT_GAS_RESERVE} MNT.`,
    }
  }

  // 3. Per-trade cap — no single trade > MAX_TRADE_PCT of portfolio
  const maxTradeUSD = portfolioUSD * (MANTLE_AGENT_RULES.MAX_TRADE_PCT / 100)
  if (tradeAmountUSD > maxTradeUSD) {
    return {
      allowed: false,
      reason: `Trade of $${tradeAmountUSD.toFixed(2)} exceeds ${MANTLE_AGENT_RULES.MAX_TRADE_PCT}% per-trade cap ($${maxTradeUSD.toFixed(2)}).`,
    }
  }

  // 4. Dust floor
  if (tradeAmountUSD < MANTLE_AGENT_RULES.MIN_TRADE_USD) {
    return {
      allowed: false,
      reason: `Trade value $${tradeAmountUSD.toFixed(4)} is below $${MANTLE_AGENT_RULES.MIN_TRADE_USD} minimum.`,
    }
  }

  // 5. Drawdown circuit breaker
  if (drawdownPct >= MANTLE_AGENT_RULES.MAX_DRAWDOWN_PCT) {
    return {
      allowed: false,
      reason: `Drawdown of ${drawdownPct.toFixed(1)}% exceeds ${MANTLE_AGENT_RULES.MAX_DRAWDOWN_PCT}% circuit breaker — agent paused.`,
    }
  }

  // 6. Daily trade cap
  if (tradesToday >= MANTLE_AGENT_RULES.MAX_DAILY_TRADES) {
    return {
      allowed: false,
      reason: `Daily trade cap of ${MANTLE_AGENT_RULES.MAX_DAILY_TRADES} reached.`,
    }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERC-20 ABI (minimal — balanceOf, transfer, approve)
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
]

// ─────────────────────────────────────────────────────────────────────────────
// Wallet helpers (stateless — no wallet stored here)
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleWallet {
  address:    string
  privateKey: string
  mnemonic?:  string
}

/** Generate a fresh random Mantle wallet (EVM-compatible). */
export function generateMantleWallet(): MantleWallet {
  const wallet = ethers.Wallet.createRandom()
  return {
    address:    wallet.address,
    privateKey: wallet.privateKey,
    mnemonic:   wallet.mnemonic?.phrase,
  }
}

/** Derive a MantleWallet from an existing private key. */
export function walletFromPrivateKey(privateKey: string): MantleWallet {
  const wallet = new ethers.Wallet(privateKey)
  return { address: wallet.address, privateKey }
}

/**
 * Encrypt a private key with a password using AES via ethers.js.
 * Returns the JSON keystore string — safe to store in localStorage.
 */
export async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const wallet = new ethers.Wallet(privateKey)
  return wallet.encrypt(password)
}

/** Decrypt a keystore JSON with the user's password. */
export async function decryptPrivateKey(keystoreJson: string, password: string): Promise<string> {
  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password)
  return wallet.privateKey
}

// ─────────────────────────────────────────────────────────────────────────────
// MantleClient
// ─────────────────────────────────────────────────────────────────────────────

export class MantleClient {
  private provider: ethers.JsonRpcProvider
  private signer:   ethers.Wallet | null = null
  readonly network: MantleNetwork

  constructor(network: MantleNetwork = 'testnet', privateKey?: string) {
    this.network  = network
    this.provider = new ethers.JsonRpcProvider(MANTLE_RPC[network])

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider)
    }
  }

  /** Switch to a backup RPC if primary fails. */
  useBackupRpc(): void {
    this.provider = new ethers.JsonRpcProvider(MANTLE_RPC_BACKUP[this.network])
    if (this.signer) {
      this.signer = this.signer.connect(this.provider)
    }
  }

  /** Load a signer wallet (call after construction if key wasn't provided). */
  loadWallet(privateKey: string): string {
    this.signer = new ethers.Wallet(privateKey, this.provider)
    return this.signer.address
  }

  getAddress(): string | null {
    return this.signer?.address ?? null
  }

  getWallet(): ethers.Wallet | null {
    return this.signer
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  /** Native MNT balance (in MNT, not wei). */
  async getMNTBalance(address?: string): Promise<number> {
    const addr = address ?? this.signer?.address
    if (!addr) throw new Error('No address provided and no wallet loaded.')
    try {
      const raw = await this.provider.getBalance(addr)
      return parseFloat(ethers.formatEther(raw))
    } catch {
      this.useBackupRpc()
      const raw = await this.provider.getBalance(addr)
      return parseFloat(ethers.formatEther(raw))
    }
  }

  /** ERC-20 token balance. Returns 0 on error (token may not exist on testnet). */
  async getTokenBalance(tokenSymbol: string, address?: string): Promise<number> {
    const addr  = address ?? this.signer?.address
    const token = MANTLE_TOKENS[this.network][tokenSymbol]
    if (!addr || !token) return 0
    if (!token.address || token.address === '0x0000000000000000000000000000000000000000') return 0

    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, this.provider)
      const raw      = await contract.balanceOf(addr)
      return parseFloat(ethers.formatUnits(raw, token.decimals))
    } catch {
      return 0
    }
  }

  /**
   * Get all token balances for an address.
   * Returns a map of symbol → balance.
   */
  async getAllBalances(address?: string): Promise<Record<string, number>> {
    const addr    = address ?? this.signer?.address
    const tokens  = MANTLE_TOKENS[this.network]
    const results: Record<string, number> = {}

    results['MNT'] = await this.getMNTBalance(addr)

    await Promise.all(
      Object.keys(tokens)
        .filter(s => s !== 'MNT')
        .map(async (symbol) => {
          results[symbol] = await this.getTokenBalance(symbol, addr)
        })
    )

    return results
  }

  /**
   * Compute total portfolio USD value.
   * Requires a prices map: { MNT: 0.72, mETH: 3800, USDC: 1, ... }
   * Prices map is provided by lib/bybit.ts (N1) rather than fetched here,
   * keeping the client decoupled from the data layer.
   */
  computePortfolioUSD(
    balances: Record<string, number>,
    prices:   Record<string, number>,
  ): number {
    let total = 0
    for (const [symbol, balance] of Object.entries(balances)) {
      const price = prices[symbol] ?? 0
      total += balance * price
    }
    return total
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  /** Transfer native MNT. */
  async sendMNT(to: string, amount: number): Promise<string> {
    if (!this.signer) throw new Error('No wallet loaded.')
    const value = ethers.parseEther(amount.toString())
    const tx    = await this.signer.sendTransaction({ to, value })
    await tx.wait(1)
    return tx.hash
  }

  /** Transfer an ERC-20 token. */
  async sendToken(tokenSymbol: string, to: string, amount: number): Promise<string> {
    if (!this.signer) throw new Error('No wallet loaded.')
    const token = MANTLE_TOKENS[this.network][tokenSymbol]
    if (!token) throw new Error(`Token ${tokenSymbol} not configured on Mantle ${this.network}.`)

    const contract  = new ethers.Contract(token.address, ERC20_ABI, this.signer)
    const amountWei = ethers.parseUnits(amount.toString(), token.decimals)
    const tx        = await contract.transfer(to, amountWei)
    await tx.wait(1)
    return tx.hash
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /** Estimate current gas price in gwei. */
  async getGasPrice(): Promise<number> {
    const gasPrice = await this.getGasPrice()
    return parseFloat(ethers.formatUnits(gasPrice, 'gwei'))
  }

  /** Get chain ID to verify we're on the right network. */
  async getChainId(): Promise<number> {
    const network = await this.provider.getNetwork()
  return Number(network.chainId) 
  }

  /** Verify the connected chain matches what we expect. */
  async verifyNetwork(): Promise<boolean> {
    try {
      const chainId = await this.getChainId()
      return chainId === MANTLE_CHAIN_ID[this.network]
    } catch {
      return false
    }
  }
}
