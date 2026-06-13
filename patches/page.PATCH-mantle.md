# Patch — app/page.tsx
# Session N3 · Register MantleAgentTab in the TABS map
# TWO FIND/REPLACE operations — apply both in order.

## OPERATION 1 — Add the import

### FIND (exact text — the last import before the TABS const)

import AgentPerformanceTab from '@/components/tabs/AgentPerformanceTab'

### REPLACE WITH

import AgentPerformanceTab from '@/components/tabs/AgentPerformanceTab'

// ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ──────────
import MantleAgentTab     from '@/components/tabs/MantleAgentTab'

---

## OPERATION 2 — Add the tab entry to the TABS map

### FIND (exact text — the last entry in the TABS const)

  performance:     <AgentPerformanceTab />,
}

### REPLACE WITH

  performance:     <AgentPerformanceTab />,

  // Mantle AI Trading Agent (Session N)
  'mantle-agent':  <MantleAgentTab />,
}

---

## VERIFICATION
After applying:
- `npm run build` (or `next build`) should complete without TypeScript errors.
- Navigating to the 'mantle-agent' tab (via Sidebar or MobileDrawer) should
  render the full MantleAgentTab dashboard.
- The TABS map should now have 21 entries (was 20 before this patch).

## NOTE
No other change to page.tsx is needed. The existing routing logic
(`TABS[activeTab]`) handles all tabs generically — adding an entry
to the TABS map is all that's required.
