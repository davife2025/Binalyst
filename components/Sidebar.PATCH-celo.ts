// components/Sidebar.PATCH-celo.ts — Session L
//
// Adds a new "Celo Agent" section + nav item to the sidebar, surfacing the
// new CeloAgentTab. Two small additions to components/Sidebar.tsx.
//
// ─────────────────────────────────────────────────────────────────────────
// 1. Update the NavItem `section` union type
// ─────────────────────────────────────────────────────────────────────────
//
// FIND:
//   section:  'intelligence' | 'agent' | 'binance' | 'tools'
//
// REPLACE WITH:
//   section:  'intelligence' | 'agent' | 'binance' | 'tools' | 'celo'
//
// ─────────────────────────────────────────────────────────────────────────
// 2. Add a nav item to the NAV array
// ─────────────────────────────────────────────────────────────────────────
//
// FIND (end of the "Trading Agent" block, just before "── Binance"):
//   { id: 'agent',        label: 'Rules Engine',    icon: '🤖',             section: 'agent' },
//
//   // ── Binance ───────────────────────────────────────────────────────────────
//
// REPLACE WITH:
//   { id: 'agent',        label: 'Rules Engine',    icon: '🤖',             section: 'agent' },
//
//   // ── Celo Payments Agent (Session L — Onchain Agents Hackathon) ───────────────
//   { id: 'celo-agent',   label: 'Celo Agent',      icon: '🟡',  dot: true, section: 'celo' },
//
//   // ── Binance ───────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────
// 3. Add the section to the SECTIONS array
// ─────────────────────────────────────────────────────────────────────────
//
// FIND:
//   const SECTIONS: { id: NavItem['section']; label: string; color: string }[] = [
//     { id: 'intelligence', label: 'Intelligence',   color: '#3498db'       },
//     { id: 'agent',        label: 'Trading Agent',  color: 'var(--yellow)' },
//     { id: 'binance',      label: 'Binance',        color: 'var(--green)'  },
//     { id: 'tools',        label: 'Tools',          color: 'var(--text3)'  },
//   ]
//
// REPLACE WITH:
//   const SECTIONS: { id: NavItem['section']; label: string; color: string }[] = [
//     { id: 'intelligence', label: 'Intelligence',   color: '#3498db'       },
//     { id: 'agent',        label: 'Trading Agent',  color: 'var(--yellow)' },
//     { id: 'celo',         label: 'Celo Agent',     color: '#FCFF52'       },
//     { id: 'binance',      label: 'Binance',        color: 'var(--green)'  },
//     { id: 'tools',        label: 'Tools',          color: 'var(--text3)'  },
//   ]
//
// Note: #FCFF52 is Celo's brand yellow — distinguishes this section visually
// from the BNB "Trading Agent" section (var(--yellow), Binance gold).
//
// ─────────────────────────────────────────────────────────────────────────
// No other changes needed — the existing render loop iterates SECTIONS and
// filters NAV by section automatically.
// ─────────────────────────────────────────────────────────────────────────
