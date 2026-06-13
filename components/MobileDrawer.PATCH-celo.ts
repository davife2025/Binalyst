// components/MobileDrawer.PATCH-celo.ts — Session L
//
// Adds a "Celo Agent" section to the mobile drawer, surfacing the new
// CeloAgentTab on mobile. One addition to the SECTIONS array in
// components/MobileDrawer.tsx.
//
// ─────────────────────────────────────────────────────────────────────────
// FIND (the "Trading Agent" section, specifically its closing):
// ─────────────────────────────────────────────────────────────────────────
//
//   {
//     label: 'Trading Agent',
//     color: '#F0B90B',
//     items: [
//       { id: 'agent-wallet', label: 'Agent Wallet',  icon: '🔐', desc: 'Self-custodial BSC wallet' },
//       { id: 'strategy',     label: 'Strategy',      icon: '🧠', desc: 'AI-parsed trading rules' },
//       { id: 'competition',  label: 'Competition',   icon: '🏆', desc: 'Live PnL · trade log' },
//       { id: 'performance',  label: 'Performance',   icon: '📊', desc: 'Portfolio · hourly PnL' },
//       { id: 'submission',   label: 'Submission',    icon: '📝', desc: 'Dorahacks writeup' },
//       { id: 'agent',        label: 'Rules Engine',  icon: '🤖', desc: 'Simple rules agent' },
//     ],
//   },
//
// ─────────────────────────────────────────────────────────────────────────
// REPLACE WITH (insert a new section right after it):
// ─────────────────────────────────────────────────────────────────────────
//
//   {
//     label: 'Trading Agent',
//     color: '#F0B90B',
//     items: [
//       { id: 'agent-wallet', label: 'Agent Wallet',  icon: '🔐', desc: 'Self-custodial BSC wallet' },
//       { id: 'strategy',     label: 'Strategy',      icon: '🧠', desc: 'AI-parsed trading rules' },
//       { id: 'competition',  label: 'Competition',   icon: '🏆', desc: 'Live PnL · trade log' },
//       { id: 'performance',  label: 'Performance',   icon: '📊', desc: 'Portfolio · hourly PnL' },
//       { id: 'submission',   label: 'Submission',    icon: '📝', desc: 'Dorahacks writeup' },
//       { id: 'agent',        label: 'Rules Engine',  icon: '🤖', desc: 'Simple rules agent' },
//     ],
//   },
//   {
//     label: 'Celo Agent',
//     color: '#FCFF52',
//     items: [
//       { id: 'celo-agent', label: 'Celo Agent', icon: '🟡', desc: 'Recurring CELO/cUSD payments' },
//     ],
//   },
//
// ─────────────────────────────────────────────────────────────────────────
// No other changes needed — the render loop iterates SECTIONS generically.
// ─────────────────────────────────────────────────────────────────────────
