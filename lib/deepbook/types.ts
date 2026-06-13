/**
 * lib/deepbook/types.ts
 * DeepBook v3 type definitions — Session L.
 *
 * DeepBook is Sui's native central limit order book protocol.
 * These types model the core primitives needed by the Sui agent:
 *   - Pool: a trading pair (e.g. SUI/USDC)
 *   - Order: a limit or market order placed on a pool
 *   - Fill: a matched trade record
 *   - OrderBook: the current bid/ask state
 *
 * Docs: https://docs.sui.io/onchain-finance/deepbookv3/deepbook
 *
 * ISOLATION GUARANTEE: no imports from any existing Binalyst lib.
 */

import type { SuiNetwork } from '../sui/client'

// ─────────────────────────────────────────────────────────────────────────────
// Pool
// ─────────────────────────────────────────────────────────────────────────────

export interface DeepBookPool {
  /** On-chain pool object ID */
  poolId:       string
  /** Base asset type (e.g. "0x2::sui::SUI") */
  baseType:     string
  /** Quote asset type (e.g. "0xdba...::usdc::USDC") */
  quoteType:    string
  /** Human-readable pair label */
  pair:         string           // e.g. "SUI/USDC"
  /** Tick size in quote asset units */
  tickSize:     number
  /** Lot size in base asset units */
  lotSize:      number
  /** Min order size in base units */
  minSize:      number
  /** Current best bid price */
  bestBid?:     number
  /** Current best ask price */
  bestAsk?:     number
  /** 24h volume in quote asset */
  volume24h?:   number
  /** Whether this pool is active */
  active:       boolean
  network:      SuiNetwork
}

// Known testnet pool IDs (from DeepBook docs / sandbox)
export const DEEPBOOK_TESTNET_POOLS: Record<string, Partial<DeepBookPool>> = {
  'SUI/USDC': {
    poolId:    '0x4405b50d791fd3346754e8171aaab6bc2ed26c2c46efdd033c14b30ae507ac33',
    baseType:  '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    quoteType: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    pair:      'SUI/USDC',
    tickSize:  0.001,
    lotSize:   0.1,
    minSize:   0.1,
    active:    true,
    network:   'testnet',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────────────────────────────

export type OrderSide   = 'bid' | 'ask'      // bid = buy, ask = sell
export type OrderType   = 'limit' | 'market'
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'partial' | 'dry_run'

export interface DeepBookOrder {
  /** Client-generated order ID (u64 on-chain) */
  clientOrderId:  string
  /** On-chain order ID (assigned by DeepBook) */
  orderId?:       string
  poolId:         string
  pair:           string
  side:           OrderSide
  type:           OrderType
  /** Price in quote asset per base unit */
  price:          number
  /** Quantity in base asset */
  quantity:       number
  /** Filled quantity */
  filledQty:      number
  status:         OrderStatus
  /** Sui transaction digest */
  txDigest?:      string
  /** Walrus blob ID for the activity log entry */
  walrusBlobId?:  string
  network:        SuiNetwork
  placedAt:       number
  updatedAt:      number
  /** Was this a dry-run simulation */
  dryRun:         boolean
  /** Agent decision context */
  agentReasoning?: string
  signalScore?:    number
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill (matched trade)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeepBookFill {
  fillId:        string
  orderId:       string
  poolId:        string
  pair:          string
  side:          OrderSide
  price:         number
  quantity:      number
  quoteQuantity: number    // price × quantity
  maker:         boolean
  timestamp:     number
  txDigest:      string
  network:       SuiNetwork
}

// ─────────────────────────────────────────────────────────────────────────────
// Order book (bid/ask levels)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price:    number
  quantity: number
  orders:   number   // number of orders at this level
}

export interface DeepBookOrderBook {
  poolId:    string
  pair:      string
  bids:      OrderBookLevel[]   // sorted descending
  asks:      OrderBookLevel[]   // sorted ascending
  spread:    number
  midPrice:  number
  updatedAt: number
  network:   SuiNetwork
}

// ─────────────────────────────────────────────────────────────────────────────
// Place order request / response
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceOrderRequest {
  poolId:        string
  side:          OrderSide
  type:          OrderType
  price:         number
  quantity:      number
  walletAddress: string
  network:       SuiNetwork
  dryRun:        boolean
  agentReasoning?: string
  signalScore?:    number
}

export interface PlaceOrderResponse {
  success:       boolean
  order?:        DeepBookOrder
  ptb?:          unknown        // PTB for wallet to sign (live mode)
  error?:        string
  walrusBlobId?: string         // activity log blob ID
}

export interface CancelOrderRequest {
  poolId:    string
  orderId:   string
  walletAddress: string
  network:   SuiNetwork
}

export interface CancelOrderResponse {
  success:  boolean
  txDigest?: string
  error?:   string
}
