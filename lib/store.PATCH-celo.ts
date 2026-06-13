// lib/store.PATCH-celo.ts — Session L
//
// Adds 'celo-agent' to the ActiveTab union so the new Celo Payments Agent
// tab can be selected. This is the ONLY change needed in lib/store.ts.
//
// ─────────────────────────────────────────────────────────────────────────
// FIND (in lib/store.ts):
// ─────────────────────────────────────────────────────────────────────────
//
//   // ── Autonomous Agent (Sessions A-G) ───────────────────────────────────────
//   | 'agent-wallet'
//   | 'signals'
//   | 'strategy'
//   | 'competition'
//   | 'submission'
//   | 'performance'
//
// ─────────────────────────────────────────────────────────────────────────
// REPLACE WITH:
// ─────────────────────────────────────────────────────────────────────────
//
//   // ── Autonomous Agent (Sessions A-G) ───────────────────────────────────────
//   | 'agent-wallet'
//   | 'signals'
//   | 'strategy'
//   | 'competition'
//   | 'submission'
//   | 'performance'
//   // ── Celo Payments Agent (Session L — Onchain Agents Hackathon) ────────────
//   | 'celo-agent'
//
// ─────────────────────────────────────────────────────────────────────────
// No other changes to lib/store.ts are needed. setActiveTab already accepts
// the full ActiveTab union, so 'celo-agent' is automatically valid.
// ─────────────────────────────────────────────────────────────────────────
