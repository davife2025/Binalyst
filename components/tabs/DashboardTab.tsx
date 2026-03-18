'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

// ── Nav items — 6 columns × 2 rows = 12 items ────────────────────────────
const NAV_COLS = [
  [{ id: 'chat',      icon: '◈', label: 'AI Assistant', desc: 'Ask anything'  },
   { id: 'markets',   icon: '◐', label: 'Markets',       desc: 'Live prices'   }],
  [{ id: 'portfolio', icon: '◑', label: 'Portfolio',     desc: 'Holdings'      },
   { id: 'trading',   icon: '⚡', label: 'Trade',         desc: 'Buy & sell'    }],
  [{ id: 'web3',      icon: '⬡', label: 'Web3',          desc: 'On-chain'      },
   { id: 'events',    icon: '◎', label: 'Events',        desc: 'Listings'      }],
  [{ id: 'square',    icon: '✦', label: 'Square',        desc: 'Social'        },
   { id: 'messaging', icon: '📱', label: 'Messaging',     desc: 'Telegram'      }],
  [{ id: 'alerts',    icon: '🔔', label: 'Alerts',        desc: 'Notify'        },
   { id: 'agent',     icon: '🤖', label: 'Agent',         desc: 'Auto rules'    }],
  [{ id: 'learn',     icon: '◉', label: 'Learn',         desc: 'Education'     },
   { id: 'settings',  icon: '⚙', label: 'Settings',      desc: 'Configure'     }],
]

// ── Feature mini-previews ─────────────────────────────────────────────────
const pBase: React.CSSProperties = {
  padding: '8px 8px 6px',
  background: 'rgba(0,0,0,0.3)',
  borderBottom: '1px solid var(--border)',
  minHeight: 68,
}

function PreviewChat() {
  return (
    <div style={pBase}>
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ fontSize:7, padding:'3px 5px', borderRadius:4, background:'#1a1a1a', color:'#aaa', alignSelf:'flex-end' }}>BTC price?</div>
        <div style={{ fontSize:7, padding:'3px 5px', borderRadius:4, background:'rgba(240,185,11,0.1)', color:'#F0B90B', border:'1px solid rgba(240,185,11,0.15)' }}>BTC $103,420 ↑2.4%</div>
        <div style={{ fontSize:7, padding:'3px 5px', borderRadius:4, background:'#1a1a1a', color:'#aaa', alignSelf:'flex-end' }}>Top movers?</div>
      </div>
    </div>
  )
}

function PreviewMarkets() {
  return (
    <div style={pBase}>
      {[['BTC','$103,420','+2.4%',true],['ETH','$3,821','+1.8%',true],['SOL','$182','-0.9%',false],['BNB','$612','+3.1%',true]].map(([s,v,c,up]) => (
        <div key={s as string} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize:8, color:'#666' }}>{s}</span>
          <span style={{ fontSize:8, color:'var(--text2)' }}>{v}</span>
          <span style={{ fontSize:7, color: up ? '#0ECB81' : '#F6465D' }}>{c}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewPortfolio() {
  return (
    <div style={pBase}>
      {[['BTC',72,'#F0B90B','$4,210'],['ETH',45,'#0ECB81','$1,840'],['SOL',22,'#3498db','$620']].map(([s,p,col,v]) => (
        <div key={s as string} style={{ marginBottom:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: col as string }} />
              <span style={{ fontSize:7, color:'#888' }}>{s}</span>
            </div>
            <span style={{ fontSize:7, color:'#ccc' }}>{v}</span>
          </div>
          <div style={{ width:'100%', height:2, background:'rgba(255,255,255,0.06)', borderRadius:2, marginTop:2 }}>
            <div style={{ width:`${p}%`, height:2, borderRadius:2, background: col as string }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function PreviewTrade() {
  return (
    <div style={pBase}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:40 }}>
        {[30,50,40,70,60,90,75].map((h,i) => (
          <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'2px 2px 0 0', background: i>=5?'#0ECB81':i>=3?'#F0B90B':'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:7, color:'#444' }}>BTCUSDT</span>
        <span style={{ fontSize:7, color:'#0ECB81' }}>↑ $103,420</span>
      </div>
    </div>
  )
}

function PreviewAlerts() {
  return (
    <div style={pBase}>
      {[['BTC','above $105k','#F0B90B',true],['ETH','below $3.5k','#F6465D',true],['SOL','above $200','#F0B90B',false]].map(([s,c,col,on]) => (
        <div key={s as string} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.03)', borderRadius:4, padding:'3px 5px', marginBottom:3 }}>
          <span style={{ fontSize:7, color:'#888' }}>{s}</span>
          <span style={{ fontSize:7, color: col as string }}>{c}</span>
          <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background: on?'rgba(14,203,129,0.1)':'rgba(246,70,93,0.1)', color: on?'#0ECB81':'#F6465D' }}>{on?'ON':'OFF'}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewWeb3() {
  return (
    <div style={pBase}>
      <div style={{ fontSize:7, color:'#444', marginBottom:4 }}>0x1a2b...9f3c</div>
      {[['Rug pull','Low','#0ECB81'],['Honeypot','No','#0ECB81'],['Ownership','Renounced','#F0B90B'],['Liq. lock','Yes','#0ECB81']].map(([l,v,col]) => (
        <div key={l as string} style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
          <span style={{ fontSize:7, color:'#555' }}>{l}</span>
          <span style={{ fontSize:7, color: col as string }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewAgent() {
  return (
    <div style={pBase}>
      {[['IF BTC > $105k','BUY ETH','#0ECB81','14,203,129'],['IF RSI > 80','ALERT','#F0B90B','240,185,11'],['DAILY 9AM','POST','#3498db','52,152,219']].map(([cond,action,col,rgb]) => (
        <div key={cond as string} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.03)', borderRadius:4, padding:'3px 5px', marginBottom:3 }}>
          <span style={{ fontSize:7, color:'#777' }}>{cond}</span>
          <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:`rgba(${rgb},0.1)`, color: col as string }}>{action}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewEvents() {
  return (
    <div style={pBase}>
      {[['#F0B90B','LISTING','TOKEN/USDT live'],['#0ECB81','AIRDROP','HODLer snapshot'],['#3498db','LAUNCHPOOL','New farm in 2d']].map(([col,tag,text]) => (
        <div key={tag as string} style={{ display:'flex', gap:4, alignItems:'flex-start', marginBottom:4 }}>
          <div style={{ width:4, height:4, borderRadius:'50%', background: col as string, marginTop:3, flexShrink:0 }} />
          <div>
            <div style={{ fontSize:6, color: col as string }}>{tag}</div>
            <div style={{ fontSize:7, color:'#666' }}>{text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Feature columns — 4 cols × 2 rows = 8 cards ───────────────────────────
const FEAT_COLS = [
  [{ id:'chat',      icon:'◈', name:'AI Chat',    sub:'Ask, get live answers',   Preview: PreviewChat      },
   { id:'markets',   icon:'◐', name:'Markets',     sub:'Live prices & movers',    Preview: PreviewMarkets   }],
  [{ id:'portfolio', icon:'◑', name:'Portfolio',   sub:'Holdings & PnL',          Preview: PreviewPortfolio },
   { id:'trading',   icon:'⚡', name:'Trade',       sub:'Buy & sell instantly',    Preview: PreviewTrade     }],
  [{ id:'alerts',    icon:'🔔', name:'Alerts',      sub:'Price notifications',     Preview: PreviewAlerts    },
   { id:'web3',      icon:'⬡', name:'Web3 Audit',  sub:'Contract risk check',     Preview: PreviewWeb3      }],
  [{ id:'agent',     icon:'🤖', name:'Auto Agent',  sub:'Rules that trade for you',Preview: PreviewAgent     },
   { id:'events',    icon:'◎', name:'Events',      sub:'Listings & airdrops',     Preview: PreviewEvents    }],
]

// ── Infinite scroll hook ──────────────────────────────────────────────────
function useScroll(ref: React.RefObject<HTMLDivElement>, colW: number) {
  useEffect(() => {
    const track = ref.current
    if (!track) return
    const orig = track.innerHTML
    track.innerHTML = orig + orig + orig
    const total = (track.children.length / 3) * colW
    let offset = 0, paused = false, dragging = false, startX = 0, startOff = 0, raf: number

    const tick = () => {
      if (!paused && !dragging) {
        offset += 0.4
        if (offset > total) offset -= total
        track.style.transform = `translateX(${-offset}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const wrap = track.parentElement!
    const stop = () => { paused = true }
    const go   = () => { paused = false }
    const down = (e: MouseEvent) => { dragging = true; paused = true; startX = e.clientX; startOff = offset; e.preventDefault() }
    const move = (e: MouseEvent) => { if (!dragging) return; offset = startOff + (startX - e.clientX); if (offset > total*2) offset -= total; if (offset < 0) offset += total; track.style.transform = `translateX(${-offset}px)` }
    const up   = () => { if (dragging) { dragging = false; paused = false } }
    const ts   = (e: TouchEvent) => { dragging = true; paused = true; startX = e.touches[0].clientX; startOff = offset }
    const tm   = (e: TouchEvent) => { if (!dragging) return; offset = startOff + (startX - e.touches[0].clientX); if (offset > total*2) offset -= total; if (offset < 0) offset += total; track.style.transform = `translateX(${-offset}px)` }
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

// ── Component ─────────────────────────────────────────────────────────────
export default function DashboardTab() {
  const { setActiveTab } = useStore()
  const { data: session } = useSession()
  const name  = session?.user?.name?.split(' ')[0] ?? 'there'
  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const navRef  = useRef<HTMLDivElement>(null)
  const featRef = useRef<HTMLDivElement>(null)

  useScroll(navRef,  116)
  useScroll(featRef, 116)

  const wrap: React.CSSProperties  = { overflow:'hidden', cursor:'grab', userSelect:'none' }
  const track: React.CSSProperties = { display:'flex', gap:8, width:'max-content' }
  const col: React.CSSProperties   = { display:'flex', flexDirection:'column', gap:8 }

  const navCard: React.CSSProperties = {
    width: 108, display:'flex', flexDirection:'column', alignItems:'center',
    justifyContent:'center', gap:5, padding:'12px 8px', borderRadius:10,
    background:'var(--bg2)', border:'1px solid var(--border)',
    cursor:'pointer', textAlign:'center',
  }

  const featCard: React.CSSProperties = {
    width: 108, borderRadius:10, background:'var(--bg2)',
    border:'1px solid var(--border)', cursor:'pointer',
    overflow:'hidden', textAlign:'left', padding:0,
  }

  const Divider = ({ label }: { label: string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 12px' }}>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
      <span style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--text3)' }}>{label}</span>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  )

  const hover = (e: React.MouseEvent, on: boolean) => {
    const el = e.currentTarget as HTMLElement
    el.style.borderColor = on ? 'var(--yellow)' : 'var(--border)'
    if (!el.querySelector('.feat-preview-inner')) el.style.background = on ? 'var(--bg3)' : 'var(--bg2)'
  }

  return (
    <div style={{ minHeight:'100%', background:'var(--bg)', fontFamily:"'DM Mono','Space Mono',monospace" }}>
    <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 20px 40px' }}>

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
          Trade smarter with <span style={{ color:'var(--yellow)' }}>live market data</span>, on-chain analytics, and an AI agent that works for you 24/7.
        </div>
      </div>

      {/* ── Navigate ── */}
      <Divider label="Navigate" />
      <div style={wrap}>
        <div ref={navRef} style={track}>
          {NAV_COLS.map((pair, ci) => (
            <div key={ci} style={col}>
              {pair.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  style={navCard}
                  onMouseEnter={e => hover(e, true)}
                  onMouseLeave={e => hover(e, false)}
                >
                  <span style={{ fontSize:15, opacity:0.75 }}>{item.icon}</span>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{item.label}</div>
                  <div style={{ fontSize:9, color:'var(--text3)' }}>{item.desc}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <Divider label="Features" />
      <div style={wrap}>
        <div ref={featRef} style={track}>
          {FEAT_COLS.map((pair, ci) => (
            <div key={ci} style={col}>
              {pair.map(({ id, icon, name: fn, sub, Preview }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  style={featCard}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--yellow)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <Preview />
                  <div style={{ padding:'6px 8px' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text)' }}>{icon} {fn}</div>
                    <div style={{ fontSize:8, color:'var(--text3)', marginTop:1 }}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)', textAlign:'center', fontSize:9, textTransform:'uppercase', letterSpacing:'0.15em', color:'var(--text3)' }}>
        Binance Skills Hub · Kimi K2 · OpenClaw
      </div>

      <style>{`@keyframes bnPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
    </div>
  )
}