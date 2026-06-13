# Patch — app/page.tsx + components/Sidebar.tsx
# Session N4 · Wire MantleSubmissionTab into nav and routing
# TWO files, THREE operations total.

---

## FILE 1: app/page.tsx

### OPERATION 1 — Add import

#### FIND (exact text)

// ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ──────────
import MantleAgentTab     from '@/components/tabs/MantleAgentTab'

#### REPLACE WITH

// ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ──────────
import MantleAgentTab       from '@/components/tabs/MantleAgentTab'
import MantleSubmissionTab  from '@/components/tabs/MantleSubmissionTab'

---

### OPERATION 2 — Add TABS entry

#### FIND (exact text)

  // Mantle AI Trading Agent (Session N)
  'mantle-agent':  <MantleAgentTab />,
}

#### REPLACE WITH

  // Mantle AI Trading Agent (Session N)
  'mantle-agent':      <MantleAgentTab />,
  'mantle-submission': <MantleSubmissionTab />,
}

---

## FILE 2: lib/store.ts

### OPERATION 3 — Add to ActiveTab union

#### FIND (exact text)

  // ── Mantle AI Trading Agent (Session N) ───────────────────────────────────
  | 'mantle-agent'

#### REPLACE WITH

  // ── Mantle AI Trading Agent (Session N) ───────────────────────────────────
  | 'mantle-agent'
  | 'mantle-submission'

---

## FILE 3: components/Sidebar.tsx

### OPERATION 4 — Add nav item to Mantle section

#### FIND (exact text)

  { id: 'mantle-agent', label: 'Mantle Agent',  icon: '⬡',  badge: 'NEW', section: 'mantle' },

#### REPLACE WITH

  { id: 'mantle-agent',      label: 'Mantle Agent',      icon: '⬡',  badge: 'NEW', section: 'mantle' },
  { id: 'mantle-submission', label: 'Submit Hackathon',   icon: '🏆', section: 'mantle' },

---

## VERIFICATION
After applying all operations:
- Sidebar should show two items under Mantle Agent: ⬡ Mantle Agent + 🏆 Submit Hackathon
- Clicking 🏆 Submit Hackathon should render MantleSubmissionTab
- TypeScript union now includes 'mantle-submission'
- `npm run build` completes without errors
