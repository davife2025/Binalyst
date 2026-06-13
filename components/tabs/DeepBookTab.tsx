'use client'

/**
 * components/tabs/DeepBookTab.tsx
 * DeepBook live trading tab — Session L.
 *
 * Shows:
 *   - Live order book (bid/ask levels) for SUI/USDC
 *   - Agent order history with Walrus blob links (on-chain proof)
 *   - Manual order placement (dry-run or live)
 *   - Walrus activity log viewer
 *
 * NEW FILE — does not modify any existing tab or component.
 * Uses: lib/deepbook/client.ts, lib/deepbook/types.ts,
 *       lib/walrus/activityLog.ts, lib/store.sui.ts
 */

import { useState, useEffect, useCallback } from 'react'
import { useSuiStore }          from '@/lib/store.sui'
import { usdToBaseQuantity, formatSide } from '@/lib/deepbook/client'
import type {
  DeepBookOrderBook,
  DeepBookOrder,
  DeepBookPool,
  OrderSide,
} from '@/lib/deepbook/types'

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DeepBookTab() {
  const { walletAddress, network, policy } = useSuiStore()
  const [activeView, setActiveView] = useState<'book' | 'orders' | 'log'>('book')
  const [pools,      setPools]      = useState<DeepBookPool[]>([])
  const [selectedPool, setSelectedPool] = useState<DeepBookPool | null>(null)
  const [orderBook,  setOrderBook]  = useState<DeepBookOrderBook | null>(null)
  const [orders,     setOrders]     = useState<DeepBookOrder[]>([])
  const [loading,    setLoading]    = useState(false)

  // Load pools on mount
  useEffect(() => {
    fetch(`/api/deepbook/pools?network=${network}`)
      .then(r => r.json())
      .then((d: { pools?: DeepBookPool[] }) => {
        const list = d.pools ?? []
        setPools(list)
        if (list.length > 0 && !selectedPool) setSelectedPool(list[0])
      })
      .catch(() => {})
  }, [network])

  // Load order book when pool changes
  const refreshBook = useCallback(() => {
    if (!selectedPool) return
    setLoading(true)
    fetch(`/api/deepbook/pools?network=${network}&poolId=${selectedPool.poolId}&pair=${encodeURIComponent(selectedPool.pair)}`)
      .then(r => r.json())
      .then((book: DeepBookOrderBook) => setOrderBook(book))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedPool, network])

  useEffect(() => {
    refreshBook()
    const timer = setInterval(refreshBook, 15_000)
    return () => clearInterval(timer)
  }, [refreshBook])

  return (
    <div style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            DeepBook
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
            background: 'var(--color-background-info)', color: 'var(--color-text-info)',
          }}>
            SUI ON-CHAIN ORDER BOOK
          </span>
          {orderBook && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Mid: ${orderBook.midPrice.toFixed(4)} · Spread: ${orderBook.spread.toFixed(4)}
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          Live on-chain order book. Agent orders are logged to Walrus as immutable activity records.
        </p>
      </div>

      {/* Pool selector */}
      {pools.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {pools.map(p => (
            <button
              key={p.poolId}
              onClick={() => setSelectedPool(p)}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--color-border-secondary)',
                background: selectedPool?.poolId === p.poolId
                  ? 'var(--color-text-primary)' : 'transparent',
                color: selectedPool?.poolId === p.poolId
                  ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
                fontWeight: selectedPool?.poolId === p.poolId ? 500 : 400,
              }}
            >
              {p.pair}
            </button>
          ))}
          <button
            onClick={refreshBook}
            style={{
              marginLeft: 'auto', padding: '6px 12px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--color-border-secondary)', background: 'transparent',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      )}

      {/* View nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border-tertiary)', paddingBottom: 0 }}>
        {[
          { id: 'book'   as const, label: '📊 Order Book'   },
          { id: 'orders' as const, label: '📋 Order History' },
          { id: 'log'    as const, label: '🔗 Walrus Log'    },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none',
              borderBottom: activeView === v.id ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              color: activeView === v.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeView === v.id ? 500 : 400, cursor: 'pointer', marginBottom: -1,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'book'   && <OrderBookView book={orderBook} pool={selectedPool} onOrder={(o) => setOrders(prev => [o, ...prev])} walletAddress={walletAddress} network={network} policy={policy} />}
      {activeView === 'orders' && <OrderHistoryView orders={orders} />}
      {activeView === 'log'    && <WalrusLogView orders={orders} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order book view
// ─────────────────────────────────────────────────────────────────────────────

function OrderBookView({ book, pool, onOrder, walletAddress, network, policy }: {
  book:          DeepBookOrderBook | null
  pool:          DeepBookPool | null
  onOrder:       (o: DeepBookOrder) => void
  walletAddress: string | null
  network:       string
  policy:        unknown
}) {
  const [side,     setSide]     = useState<OrderSide>('bid')
  const [usdAmt,   setUsdAmt]   = useState('50')
  const [placing,  setPlacing]  = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)

  async function placeOrder() {
    if (!pool || !walletAddress) { setMsg('Connect wallet first'); return }
    const usd = parseFloat(usdAmt)
    if (isNaN(usd) || usd <= 0) { setMsg('Invalid amount'); return }

    const midPrice = book?.midPrice ?? 1
    const qty      = usdToBaseQuantity(usd, midPrice, pool.lotSize ?? 0.1)
    if (qty <= 0) { setMsg('Amount too small for lot size'); return }

    setPlacing(true)
    setMsg(null)
    try {
      const res  = await fetch('/api/deepbook/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: pool.poolId, side, type: 'market',
          price: midPrice, quantity: qty,
          walletAddress, network, dryRun: true,
          agentReasoning: 'Manual order from DeepBook tab',
        }),
      })
      const data = await res.json() as { success?: boolean; order?: DeepBookOrder; walrusBlobId?: string; error?: string }
      if (data.success && data.order) {
        onOrder(data.order)
        setMsg(`✓ ${formatSide(side)} order logged${data.walrusBlobId ? ` — Walrus: ${data.walrusBlobId.slice(0, 16)}…` : ''}`)
      } else {
        setMsg(`Error: ${data.error ?? 'Unknown'}`)
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
      {/* Book levels */}
      <div>
        {book ? (
          <>
            {/* Asks (sell side) — displayed top, reversed */}
            <div style={{ marginBottom: 2 }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 6px', textTransform: 'uppercase' }}>Asks (sell)</p>
              {[...book.asks].reverse().map((lvl, i) => (
                <BookRow key={i} price={lvl.price} qty={lvl.quantity} orders={lvl.orders} side="ask" midPrice={book.midPrice} />
              ))}
            </div>

            {/* Mid price */}
            <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border-tertiary)', borderBottom: '1px solid var(--color-border-tertiary)', margin: '4px 0' }}>
              ${book.midPrice.toFixed(4)}
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                spread ${book.spread.toFixed(4)}
              </span>
            </div>

            {/* Bids (buy side) */}
            <div style={{ marginTop: 2 }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '6px 0', textTransform: 'uppercase' }}>Bids (buy)</p>
              {book.bids.map((lvl, i) => (
                <BookRow key={i} price={lvl.price} qty={lvl.quantity} orders={lvl.orders} side="bid" midPrice={book.midPrice} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>
            {pool ? 'Loading order book…' : 'Select a pool'}
          </div>
        )}
      </div>

      {/* Place order panel */}
      <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16, background: 'var(--color-background-secondary)', alignSelf: 'start' }}>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>Place order (dry run)</p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {(['bid', 'ask'] as const).map(s => (
            <button key={s} onClick={() => setSide(s)} style={{
              flex: 1, padding: '7px 0', fontSize: 13, fontWeight: side === s ? 500 : 400,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: side === s
                ? (s === 'bid' ? 'var(--color-background-success)' : 'var(--color-background-danger)')
                : 'var(--color-border-tertiary)',
              color: side === s
                ? (s === 'bid' ? 'var(--color-text-success)' : 'var(--color-text-danger)')
                : 'var(--color-text-secondary)',
            }}>
              {s === 'bid' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Amount (USD)</p>
          <input
            type="number" value={usdAmt} onChange={e => setUsdAmt(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, boxSizing: 'border-box',
              border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
          {book && (
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
              ≈ {usdToBaseQuantity(parseFloat(usdAmt) || 0, book.midPrice, pool?.lotSize ?? 0.1).toFixed(2)} {pool?.pair.split('/')[0]}
            </p>
          )}
        </div>

        <button
          onClick={placeOrder}
          disabled={placing || !walletAddress}
          style={{
            width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 500,
            borderRadius: 6, border: 'none', cursor: placing || !walletAddress ? 'not-allowed' : 'pointer',
            background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
            opacity: placing || !walletAddress ? 0.6 : 1,
          }}
        >
          {placing ? 'Placing…' : `${side === 'bid' ? 'Buy' : 'Sell'} (Dry Run)`}
        </button>

        {!walletAddress && (
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '8px 0 0', textAlign: 'center' }}>
            Connect wallet in Sui Agent tab first
          </p>
        )}

        {msg && (
          <p style={{ fontSize: 12, margin: '8px 0 0', color: msg.startsWith('✓') ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  )
}

function BookRow({ price, qty, orders, side, midPrice }: {
  price: number; qty: number; orders: number; side: 'bid' | 'ask'; midPrice: number
}) {
  const pct = Math.min(100, (Math.abs(price - midPrice) / midPrice) * 10000)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', position: 'relative', fontSize: 13 }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: `${Math.min(80, qty / 2)}%`,
        background: side === 'bid' ? 'rgba(0,200,100,0.08)' : 'rgba(255,80,80,0.08)',
        borderRadius: 3,
      }} />
      <span style={{ flex: 1, color: side === 'bid' ? 'var(--color-text-success)' : 'var(--color-text-danger)', fontFamily: 'var(--font-mono)', position: 'relative' }}>
        {price.toFixed(4)}
      </span>
      <span style={{ flex: 1, textAlign: 'right', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', position: 'relative' }}>
        {qty.toFixed(2)}
      </span>
      <span style={{ width: 32, textAlign: 'right', color: 'var(--color-text-tertiary)', fontSize: 11, position: 'relative' }}>
        {orders}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order history
// ─────────────────────────────────────────────────────────────────────────────

function OrderHistoryView({ orders }: { orders: DeepBookOrder[] }) {
  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-tertiary)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <p style={{ margin: 0 }}>No orders placed yet. Use the order book to place a dry-run order.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {orders.map((o, i) => (
        <div key={i} style={{
          padding: '12px 16px', borderRadius: 8,
          border: '1px solid var(--color-border-tertiary)',
          background: 'var(--color-background-secondary)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{o.pair}</span>
              <span style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 4,
                background: o.side === 'bid' ? 'var(--color-background-success)' : 'var(--color-background-danger)',
                color: o.side === 'bid' ? 'var(--color-text-success)' : 'var(--color-text-danger)',
              }}>
                {formatSide(o.side)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {o.quantity.toFixed(4)} @ ${o.price.toFixed(4)}
              </span>
              {o.dryRun && (
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-tertiary)' }}>
                  DRY RUN
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {new Date(o.placedAt).toLocaleTimeString()}
            </span>
          </div>
          {o.walrusBlobId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Walrus:</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-info)' }}>
                {o.walrusBlobId.slice(0, 20)}…
              </span>
              <a
                href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${o.walrusBlobId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--color-text-info)' }}
              >
                ↗ Verify
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Walrus log viewer
// ─────────────────────────────────────────────────────────────────────────────

function WalrusLogView({ orders }: { orders: DeepBookOrder[] }) {
  const [blobId,  setBlobId]  = useState('')
  const [entry,   setEntry]   = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const blobsWithLogs = orders.filter(o => o.walrusBlobId)

  async function fetchEntry(id: string) {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/walrus/log?blobId=${id}`)
      const data = await res.json() as { entry?: unknown; error?: string }
      if (data.error) throw new Error(data.error)
      setEntry(data.entry)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16, background: 'var(--color-background-secondary)' }}>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
          Look up a Walrus log entry
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={blobId}
            onChange={e => setBlobId(e.target.value)}
            placeholder="Walrus blob ID…"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={() => fetchEntry(blobId)}
            disabled={loading || !blobId}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none',
              background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
              cursor: loading || !blobId ? 'not-allowed' : 'pointer',
              opacity: loading || !blobId ? 0.6 : 1,
            }}
          >
            {loading ? '…' : 'Fetch'}
          </button>
        </div>
        {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: '8px 0 0' }}>{error}</p>}
      </div>

      {/* Quick links from current session's orders */}
      {blobsWithLogs.length > 0 && (
        <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16, background: 'var(--color-background-secondary)' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '0 0 10px' }}>
            Logged this session
          </p>
          {blobsWithLogs.map((o, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--color-border-tertiary)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                {formatSide(o.side)} {o.pair}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setBlobId(o.walrusBlobId!); fetchEntry(o.walrusBlobId!) }}
                  style={{ fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  View entry
                </button>
                <a
                  href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${o.walrusBlobId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--color-text-info)' }}
                >
                  ↗ Raw blob
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry display */}
      {entry && (
        <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16, background: 'var(--color-background-secondary)' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '0 0 10px' }}>
            Log entry — {blobId.slice(0, 20)}…
          </p>
          <pre style={{
            fontSize: 12, color: 'var(--color-text-primary)', background: 'var(--color-background-primary)',
            padding: 12, borderRadius: 6, overflow: 'auto', margin: 0,
            fontFamily: 'var(--font-mono)', lineHeight: 1.5,
          }}>
            {JSON.stringify(entry, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
