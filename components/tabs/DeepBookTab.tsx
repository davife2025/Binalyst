'use client'

/**
 * components/tabs/DeepBookTab.tsx
 * DeepBook live order book — Session L (UI rebuild).
 * Styled with Binalyst's design system.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSuiStore }          from '@/lib/store.sui'
import { usdToBaseQuantity, formatSide } from '@/lib/deepbook/client'
import type {
  DeepBookOrderBook, DeepBookOrder, DeepBookPool, OrderSide,
} from '@/lib/deepbook/types'

export default function DeepBookTab() {
  const { walletAddress, network } = useSuiStore()
  const [view,         setView]         = useState<'book' | 'orders' | 'log'>('book')
  const [pools,        setPools]        = useState<DeepBookPool[]>([])
  const [selectedPool, setSelectedPool] = useState<DeepBookPool | null>(null)
  const [orderBook,    setOrderBook]    = useState<DeepBookOrderBook | null>(null)
  const [orders,       setOrders]       = useState<DeepBookOrder[]>([])
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    fetch(`/api/deepbook/pools?network=${network}`)
      .then(r => r.json())
      .then((d: { pools?: DeepBookPool[] }) => {
        const list = d.pools ?? []
        setPools(list)
        if (list.length && !selectedPool) setSelectedPool(list[0])
      }).catch(() => {})
  }, [network])

  const refreshBook = useCallback(() => {
    if (!selectedPool) return
    setLoading(true)
    fetch(`/api/deepbook/pools?network=${network}&poolId=${selectedPool.poolId}&pair=${encodeURIComponent(selectedPool.pair)}`)
      .then(r => r.json())
      .then((b: DeepBookOrderBook) => setOrderBook(b))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedPool, network])

  useEffect(() => {
    refreshBook()
    const t = setInterval(refreshBook, 15_000)
    return () => clearInterval(t)
  }, [refreshBook])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="px-6 pt-5 pb-0 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>DeepBook</span>
          <span className="mono text-[10px] px-2 py-0.5 rounded"
            style={{ background: 'rgba(14,203,129,0.1)', color: 'var(--green)', border: '1px solid rgba(14,203,129,0.25)' }}>
            SUI ON-CHAIN ORDER BOOK
          </span>
          {orderBook && (
            <span className="mono text-[11px]" style={{ color: 'var(--text3)' }}>
              Mid ${orderBook.midPrice.toFixed(4)} · Spread ${orderBook.spread.toFixed(4)}
            </span>
          )}
        </div>

        {/* Pool + view nav row */}
        <div className="flex items-center gap-4 mb-0">
          <div className="flex gap-1">
            {pools.map(p => (
              <button key={p.poolId} onClick={() => setSelectedPool(p)}
                className="mono text-[11px] px-3 py-1 rounded transition-all"
                style={{
                  background: selectedPool?.poolId === p.poolId ? 'var(--yellow)' : 'var(--bg3)',
                  color:      selectedPool?.poolId === p.poolId ? '#000'          : 'var(--text3)',
                  border:     'none', cursor: 'pointer',
                }}>
                {p.pair}
              </button>
            ))}
            <button onClick={refreshBook}
              className="mono text-[11px] px-2 py-1 rounded"
              style={{ background: 'var(--bg3)', color: 'var(--text3)', border: 'none', cursor: 'pointer' }}>
              {loading ? '…' : '↻'}
            </button>
          </div>

          <div className="flex ml-auto">
            {[
              { id: 'book'   as const, label: 'Order Book'   },
              { id: 'orders' as const, label: 'History'      },
              { id: 'log'    as const, label: 'Walrus Log'   },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className="mono text-[11px] uppercase tracking-widest px-3 py-2.5 transition-all"
                style={{
                  color:        view === v.id ? 'var(--yellow)' : 'var(--text3)',
                  borderBottom: view === v.id ? '2px solid var(--yellow)' : '2px solid transparent',
                  background:   'none', border: 'none',
                  borderBottom: view === v.id ? '2px solid var(--yellow)' : '2px solid transparent',
                  cursor: 'pointer',
                }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {view === 'book'   && <BookView book={orderBook} pool={selectedPool} walletAddress={walletAddress} network={network} onOrder={o => setOrders(p => [o, ...p])} />}
        {view === 'orders' && <HistoryView orders={orders} />}
        {view === 'log'    && <LogView orders={orders} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order book view
// ─────────────────────────────────────────────────────────────────────────────

function BookView({ book, pool, walletAddress, network, onOrder }: {
  book: DeepBookOrderBook | null; pool: DeepBookPool | null
  walletAddress: string | null; network: string
  onOrder: (o: DeepBookOrder) => void
}) {
  const [side,    setSide]    = useState<OrderSide>('bid')
  const [usdAmt,  setUsdAmt]  = useState('50')
  const [placing, setPlacing] = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)

  async function place() {
    if (!pool || !walletAddress) { setMsg('Connect wallet first'); return }
    const usd = parseFloat(usdAmt)
    if (!usd || usd <= 0) { setMsg('Invalid amount'); return }
    const mid = book?.midPrice ?? 1
    const qty = usdToBaseQuantity(usd, mid, pool.lotSize ?? 0.1)
    if (!qty) { setMsg('Amount too small'); return }
    setPlacing(true); setMsg(null)
    try {
      const res  = await fetch('/api/deepbook/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.poolId, side, type: 'market', price: mid, quantity: qty, walletAddress, network, dryRun: true, agentReasoning: 'Manual order' }),
      })
      const data = await res.json() as { success?: boolean; order?: DeepBookOrder; walrusBlobId?: string; error?: string }
      if (data.success && data.order) {
        onOrder(data.order)
        setMsg(`✓ ${formatSide(side)} order logged${data.walrusBlobId ? ` · blob ${data.walrusBlobId.slice(0,12)}…` : ''}`)
      } else { setMsg(`Error: ${data.error ?? 'Unknown'}`) }
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Failed') }
    finally { setPlacing(false) }
  }

  return (
    <div className="flex gap-6">
      {/* Book levels */}
      <div className="flex-1">
        {book ? (
          <>
            {/* Asks */}
            <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Asks</div>
            {[...book.asks].reverse().map((l, i) => (
              <BookRow key={i} price={l.price} qty={l.quantity} side="ask" midPrice={book.midPrice} />
            ))}
            {/* Mid */}
            <div className="flex items-center gap-3 my-2 py-2 border-y" style={{ borderColor: 'var(--border)' }}>
              <span className="mono font-bold" style={{ color: 'var(--yellow)' }}>${book.midPrice.toFixed(4)}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>spread ${book.spread.toFixed(4)}</span>
            </div>
            {/* Bids */}
            <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Bids</div>
            {book.bids.map((l, i) => (
              <BookRow key={i} price={l.price} qty={l.quantity} side="bid" midPrice={book.midPrice} />
            ))}
          </>
        ) : (
          <p className="mono text-[12px]" style={{ color: 'var(--text3)' }}>{pool ? 'Loading…' : 'Select a pool'}</p>
        )}
      </div>

      {/* Place order panel */}
      <div className="w-56 shrink-0">
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Place order (dry run)</div>
          <div className="flex gap-1 mb-3">
            {(['bid', 'ask'] as const).map(s => (
              <button key={s} onClick={() => setSide(s)}
                className="flex-1 mono text-[11px] py-1.5 rounded transition-all"
                style={{
                  background: side === s ? (s === 'bid' ? 'rgba(14,203,129,0.2)' : 'rgba(246,70,93,0.2)') : 'var(--bg3)',
                  color:      side === s ? (s === 'bid' ? 'var(--green)' : 'var(--red)') : 'var(--text3)',
                  border:     'none', cursor: 'pointer', fontWeight: side === s ? 700 : 400,
                }}>
                {s === 'bid' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>
          <div className="mb-3">
            <div className="mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>Amount (USD)</div>
            <input type="number" value={usdAmt} onChange={e => setUsdAmt(e.target.value)}
              className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
              style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
            {book && (
              <div className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                ≈ {usdToBaseQuantity(parseFloat(usdAmt)||0, book.midPrice, pool?.lotSize??0.1).toFixed(2)} {pool?.pair.split('/')[0]}
              </div>
            )}
          </div>
          <button onClick={place} disabled={placing || !walletAddress}
            className="mono text-[11px] font-bold w-full py-2 rounded transition-all"
            style={{ background: 'var(--yellow)', color: '#000', border: 'none', cursor: placing||!walletAddress ? 'not-allowed' : 'pointer', opacity: placing||!walletAddress ? 0.5 : 1 }}>
            {placing ? '…' : `${side==='bid'?'Buy':'Sell'} (Dry Run)`}
          </button>
          {!walletAddress && <p className="mono text-[10px] mt-2 text-center" style={{ color: 'var(--text3)' }}>Connect wallet first</p>}
          {msg && <p className="mono text-[10px] mt-2" style={{ color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</p>}
        </div>
      </div>
    </div>
  )
}

function BookRow({ price, qty, side, midPrice }: { price: number; qty: number; side: 'bid'|'ask'; midPrice: number }) {
  const barWidth = Math.min(70, qty / 2)
  return (
    <div className="flex items-center gap-3 py-0.5 px-2 rounded relative text-[12px]" style={{ background: 'transparent' }}>
      <div className="absolute inset-y-0 right-0 rounded" style={{
        width: `${barWidth}%`,
        background: side === 'bid' ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
      }} />
      <span className="mono flex-1" style={{ color: side === 'bid' ? 'var(--green)' : 'var(--red)', position: 'relative' }}>
        {price.toFixed(4)}
      </span>
      <span className="mono" style={{ color: 'var(--text2)', position: 'relative' }}>{qty.toFixed(2)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order history
// ─────────────────────────────────────────────────────────────────────────────

function HistoryView({ orders }: { orders: DeepBookOrder[] }) {
  if (!orders.length) return (
    <p className="mono text-[12px]" style={{ color: 'var(--text3)' }}>No orders placed yet.</p>
  )
  return (
    <div className="flex flex-col gap-2">
      {orders.map((o, i) => (
        <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className="mono font-bold" style={{ color: 'var(--text)' }}>{o.pair}</span>
              <span className="mono text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: o.side==='bid' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)', color: o.side==='bid' ? 'var(--green)' : 'var(--red)' }}>
                {formatSide(o.side)}
              </span>
              <span className="mono text-[11px]" style={{ color: 'var(--text2)' }}>{o.quantity.toFixed(4)} @ ${o.price.toFixed(4)}</span>
              {o.dryRun && <span className="mono text-[10px] px-1.5 rounded" style={{ background: 'var(--bg4)', color: 'var(--text3)' }}>DRY RUN</span>}
            </div>
            <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{new Date(o.placedAt).toLocaleTimeString()}</span>
          </div>
          {o.walrusBlobId && (
            <div className="flex items-center gap-2">
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>Walrus:</span>
              <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>{o.walrusBlobId.slice(0,20)}…</span>
              <a href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${o.walrusBlobId}`}
                target="_blank" rel="noopener noreferrer"
                className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>↗ Verify</a>
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

function LogView({ orders }: { orders: DeepBookOrder[] }) {
  const [blobId,  setBlobId]  = useState('')
  const [entry,   setEntry]   = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const logsWithBlobs = orders.filter(o => o.walrusBlobId)

  async function fetch_(id: string) {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/walrus/log?blobId=${id}`)
      const data = await res.json() as { entry?: unknown; error?: string }
      if (data.error) throw new Error(data.error)
      setEntry(data.entry)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Look up blob ID</div>
        <div className="flex gap-2">
          <input value={blobId} onChange={e => setBlobId(e.target.value)} placeholder="Walrus blob ID…"
            className="mono text-[11px] flex-1 px-3 py-2 rounded outline-none"
            style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <button onClick={() => fetch_(blobId)} disabled={loading || !blobId}
            className="mono text-[11px] font-bold px-4 py-2 rounded"
            style={{ background: 'var(--yellow)', color: '#000', border: 'none', cursor: loading||!blobId ? 'not-allowed' : 'pointer', opacity: loading||!blobId ? 0.5 : 1 }}>
            {loading ? '…' : 'Fetch'}
          </button>
        </div>
        {error && <p className="mono text-[11px] mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
      </div>

      {logsWithBlobs.length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Logged this session</div>
          {logsWithBlobs.map((o, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="mono text-[11px]" style={{ color: 'var(--text)' }}>{formatSide(o.side)} {o.pair}</span>
              <div className="flex gap-3">
                <button onClick={() => { setBlobId(o.walrusBlobId!); fetch_(o.walrusBlobId!) }}
                  className="mono text-[11px]" style={{ color: 'var(--yellow)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  View
                </button>
                <a href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${o.walrusBlobId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mono text-[11px]" style={{ color: 'var(--yellow)' }}>↗ Raw</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {entry && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Entry</div>
          <pre className="mono text-[11px] p-3 rounded overflow-auto"
            style={{ background: 'var(--bg3)', color: 'var(--text)', lineHeight: 1.6 }}>
            {JSON.stringify(entry, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
