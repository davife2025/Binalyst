// app/page.PATCH-celo.ts — Session L
//
// Registers the new CeloAgentTab in the TABS registry in app/page.tsx.
// Two small additions, same pattern as the original AgentWalletTab patch.
//
// ─────────────────────────────────────────────────────────────────────────
// 1. Add the import (after the last import, e.g. after AgentPerformanceTab):
// ─────────────────────────────────────────────────────────────────────────
//
//   import AgentPerformanceTab from '@/components/tabs/AgentPerformanceTab'
// + import CeloAgentTab        from '@/components/tabs/CeloAgentTab'
//
// ─────────────────────────────────────────────────────────────────────────
// 2. Add the tab entry to TABS (after the 'performance' entry):
// ─────────────────────────────────────────────────────────────────────────
//
//   const TABS: Record<string, React.ReactNode> = {
//     ...
//     submission:      <DorahacksTab />,
//     performance:     <AgentPerformanceTab />,
// +   'celo-agent':    <CeloAgentTab />,
//   }
//
// ─────────────────────────────────────────────────────────────────────────
// No other changes needed — app/page.tsx looks up TABS[activeTab], and
// activeTab becomes 'celo-agent' once the Sidebar.PATCH-celo / MobileDrawer
// .PATCH-celo nav items are wired up.
// ─────────────────────────────────────────────────────────────────────────
