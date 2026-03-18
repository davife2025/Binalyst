'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

// ── All nav items in two rows ──────────────────────────────────────────────
const NAV_ROW1 = [
  { id: 'chat',      icon: '◈', label: 'AI Assistant', desc: 'Ask anything'  },
  { id: 'markets',   icon: '◐', label: 'Markets',       desc: 'Live prices'   },
  { id: 'portfolio', icon: '◑', label: 'Portfolio',     desc: 'Holdings'      },
  { id: 'trading',   icon: '⚡', label: 'Trade',         desc: 'Buy & sell'    },
  { id: 'web3',      icon: '⬡', label: 'Web3',          desc: 'On-chain'      },
  { id: 'events',    icon: '◎', label: 'Events',        desc: 'Listings'      },
]
const NAV_ROW2 = [
  { id: 'square',    icon: '✦', label: 'Square',        desc: 'Social'        },
  { id: 'messaging', icon: '📱', label: 'Messaging',     desc: 'Telegram'      },
  { id: 'alerts',    icon: '🔔', label: 'Alerts',        desc: 'Notify'        },
  { id: 'agent',     icon: '🤖', label: 'Agent',         desc: 'Auto rules'    },
  { id: 'learn',     icon: '◉', label: 'Learn',         desc: 'Education'     },
  { id: 'settings',  icon: '⚙', label: 'Settings',      desc: 'Configure'     },
]

// ── Feature previews — 4 unique ones that show real usage ─────────────────
const previewBase: React.CSSProperties = {
  padding: '10px 10px 8px',
  background: 'rgba(0,0,0,0.3)',
  borderBottom: '1px solid var(--border)',
  minHeight: 84,
}

function PreviewMarkets() {
  return (
    <div style={previewBase}>
      {[['BTC','$103,420','+2.4%',true],['ETH','$3,821','+1.8%',true],['SOL','$182','-0.9%',false],['BNB','$612','+3.1%',true]].map(([s,v,c,up]) => (
        <div key={s as string} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize:9, color:'#666' }}>{s}</span>
          <span style={{ fontSize:9, color:'var(--text2)' }}>{v}</span>
          <span style={{ fontSize:8, color: up ? '#0ECB81' : '#F6465D' }}>{c}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewAlerts() {
  return (
    <div style={previewBase}>
      {[['BTC','above $105k','#F0B90B',true],['ETH','below $3,500','#F6465D',true],['SOL','above $200','#F0B90B',false]].map(([s,c,col,on]) => (
        <div key={s as string} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.03)', borderRadius:5, padding:'3px 6px', marginBottom:4 }}>
          <span style={{ fontSize:8, color:'#666' }}>{s}</span>
          <span style={{ fontSize:8, color: col as string }}>{c}</span>
          <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: on ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)', color: on ? '#0ECB81' : '#F6465D' }}>{on ? 'ON' : 'OFF'}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewAgent() {
  return (
    <div style={previewBase}>
      {[['IF BTC > $105k','BUY ETH','#0ECB81'],['IF RSI > 80','ALERT','#F0B90B'],['DAILY 9AM','POST','#3498db']].map(([cond,action,col]) => (
        <div key={cond as string} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.03)', borderRadius:5, padding:'3px 6px', marginBottom:4 }}>
          <span style={{ fontSize:7, color:'#666' }}>{cond}</span>
          <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:`rgba(${col === '#0ECB81' ? '14,203,129' : col === '#F0B90B' ? '240,185,11' : '52,152,219'},0.1)`, color: col as string }}>{action}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewWeb3() {
  return (
    <div style={previewBase}>
      <div style={{ fontSize:8, color:'#444', marginBottom:5 }}>0x1a2b...9f3c</div>
      {[['Rug pull','Low','#0ECB81'],['Honeypot','No','#0ECB81'],['Ownership','Renounced','#F0B90B'],['Liq. lock','Yes','#0ECB81']].map(([l,v,col]) => (
        <div key={l as string} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
          <span style={{ fontSize:8, color:'#555' }}>{l}</span>
          <span style={{ fontSize:8, color: col as string }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

const FEATURES = [
  { id:'markets',  icon:'◐', name:'Live Markets',  sub:'Real-time Binance prices',      Preview: PreviewMarkets },
  { id:'alerts',   icon:'🔔', name:'Price Alerts',  sub:'Get notified on price moves',   Preview: PreviewAlerts  },
  { id:'agent',    icon:'🤖', name:'Auto Agent',    sub:'Rules that trade for you',      Preview: PreviewAgent   },
  { id:'web3',     icon:'⬡', name:'Web3 Audit',    sub:'Check any contract for risk',   Preview: PreviewWeb3    },
]

// ── Infinite scroll hook ───────────────────────────────────────────────────
function useInfiniteScroll(
  ref: React.RefObject<HTMLDivElement>,
  itemW: number,
  speed: number,
  dir: 1 | -1
) {
  useEffect(() => {
    const inner = ref.current
    if (!inner) return
    const orig = inner.innerHTML
    inner.innerHTML = orig + orig + orig
    const total = (inner.children.length / 3) * itemW
    let offset = 0, paused = false, dragging = false, startX = 0, startOff = 0, raf: number

    const tick = () => {
      if (!paused && !dragging) {
        offset += speed * dir
        if (dir > 0 && offset > total) offset -= total
        if (dir < 0 && offset < 0) offset += total
        inner.style.transform = `translateX(${-offset}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const wrap = inner.parentElement!
    const stop = () => { paused = true }
    const go   = () => { paused = false }
    const down = (e: MouseEvent) => { dragging = true; paused = true; startX = e.clientX; startOff = offset; e.preventDefault() }
    const move = (e: MouseEvent) => { if (!dragging) return; offset = startOff + (startX - e.clientX); if (offset > total*2) offset -= total; if (offset < 0) offset += total; inner.style.transform = `translateX(${-offset}px)` }
    const up   = () => { if (dragging) { dragging = false; paused = false } }
    const ts   = (e: TouchEvent) => { dragging = true; paused = true; startX = e.touches[0].clientX; startOff = offset }
    const tm   = (e: TouchEvent) => { if (!dragging) return; offset = startOff + (startX - e.touches[0].clientX); if (offset > total*2) offset -= total; if (offset < 0) offset += total; inner.style.transform = `translateX(${-offset}px)` }
    const te   = () => { dragging = false; paused = false }

    wrap.addEventListener('mouseenter', stop)
    wrap.addEventListener('mouseleave', go)
    wrap.addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    wrap.addEventListener('touchstart', ts, { passive: true })
    wrap.addEventListener('touchmove', tm, { passive: true })
    wrap.addEventListener('touchend', te)

    return () => {
      cancelAnimationFrame(raf)
      wrap.removeEventListener('mouseenter', stop)
      wrap.removeEventListener('mouseleave', go)
      wrap.removeEventListener('mousedown', down)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      wrap.removeEventListener('touchstart', ts)
      wrap.removeEventListener('touchmove', tm)
      wrap.removeEventListener('touchend', te)
    }
  }, [])
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardTab() {
  const { setActiveTab } = useStore()
  const { data: session } = useSession()
  const name  = session?.user?.name?.split(' ')[0] ?? 'there'
  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const nR1 = useRef<HTMLDivElement>(null)
  const nR2 = useRef<HTMLDivElement>(null)
  const fR1 = useRef<HTMLDivElement>(null)

  useInfiniteScroll(nR1, 96,  0.4,  1)
  useInfiniteScroll(nR2, 96,  0.4, -1)
  useInfiniteScroll(fR1, 158, 0.35,  1)

  const rowWrap: React.CSSProperties  = { overflow:'hidden', marginBottom:8, cursor:'grab', userSelect:'none' }
  const rowInner: React.CSSProperties = { display:'flex', gap:8, width:'max-content' }

  const navBtn: React.CSSProperties = {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap:5, padding:'10px 8px', width:88, borderRadius:10,
    background:'var(--bg2)', border:'1px solid var(--border)',
    cursor:'pointer', textAlign:'center', flexShrink:0,
  }

  const featBtn: React.CSSProperties = {
    width:150, borderRadius:12, background:'var(--bg2)',
    border:'1px solid var(--border)', cursor:'pointer',
    flexShrink:0, overflow:'hidden', textAlign:'left', padding:0,
  }

  const Divider = ({ label }: { label: string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 14px' }}>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
      <span style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--text3)' }}>{label}</span>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  )

  return (
    <div style={{ minHeight:'100%', background:'var(--bg)', fontFamily:"'DM Mono', 'Space Mono', monospace", padding:'20px 16px 40px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ width:34, height:34, borderRadius:8, background:'var(--yellow)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:'#000', flexShrink:0 }}>B</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--text3)' }}>Binalyst</div>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:1 }}>{greet}, {name}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, background:'rgba(14,203,129,0.08)', border:'1px solid rgba(14,203,129,0.2)', fontSize:10, color:'#0ECB81' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#0ECB81', animation:'bnPulse 2s infinite' }} />
          Live
        </div>
      </div>

      {/* Description */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:4 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:5 }}>Your AI-powered Binance assistant</div>
        <div style={{ fontSize:10, color:'var(--text3)', lineHeight:1.7 }}>
          Trade smarter with <span style={{ color:'var(--yellow)' }}>live market data</span>, on-chain analytics, and an AI agent that works for you 24/7 — all from one place.
        </div>
      </div>

      {/* Navigate */}
      <Divider label="Navigate" />

      <div style={rowWrap}>
        <div ref={nR1} style={rowInner}>
          {NAV_ROW1.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} style={navBtn}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--yellow)'; el.style.background='var(--bg3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.background='var(--bg2)' }}>
              <span style={{ fontSize:14, opacity:0.75 }}>{item.icon}</span>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{item.label}</div>
              <div style={{ fontSize:9, color:'var(--text3)' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={rowWrap}>
        <div ref={nR2} style={rowInner}>
          {NAV_ROW2.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} style={navBtn}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--yellow)'; el.style.background='var(--bg3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.background='var(--bg2)' }}>
              <span style={{ fontSize:14, opacity:0.75 }}>{item.icon}</span>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{item.label}</div>
              <div style={{ fontSize:9, color:'var(--text3)' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Features — single row, 4 unique previews */}
      <Divider label="Highlights" />

      <div style={{ ...rowWrap, marginBottom:0 }}>
        <div ref={fR1} style={rowInner}>
          {FEATURES.map(({ id, icon, name: fn, sub, Preview }) => (
            <button key={id} onClick={() => setActiveTab(id as any)} style={featBtn}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--yellow)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
              <Preview />
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text)' }}>{icon} {fn}</div>
                <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>{sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)', textAlign:'center', fontSize:9, textTransform:'uppercase', letterSpacing:'0.15em', color:'var(--text3)' }}>
        Binance Skills Hub · Kimi K2 · OpenClaw
      </div>

      <style>{`@keyframes bnPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}