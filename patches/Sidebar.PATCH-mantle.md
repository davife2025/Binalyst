# Patch — components/Sidebar.tsx
# Session N3 · Add Mantle AI Trading Agent section to sidebar nav
# TWO separate FIND/REPLACE operations — apply both in order.

## OPERATION 1 — Add nav items to the NAV array

### FIND (exact text — the last item in the NAV array, end of 'tools' section)

  { id: 'messaging',    label: 'Messaging',    icon: '📱',  badge: 'NEW', section: 'tools' },
]

### REPLACE WITH

  { id: 'messaging',    label: 'Messaging',    icon: '📱',  badge: 'NEW', section: 'tools' },

  // ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ───────
  { id: 'mantle-agent', label: 'Mantle Agent',  icon: '⬡',  badge: 'NEW', section: 'mantle' },
]

---

## OPERATION 2 — Add the 'mantle' section descriptor to the SECTIONS array

### FIND (exact text — end of SECTIONS array)

  { id: 'tools',        label: 'Tools',        color: 'var(--text3)'  },
]

### REPLACE WITH

  { id: 'tools',        label: 'Tools',        color: 'var(--text3)'  },
  { id: 'mantle',       label: 'Mantle Agent', color: '#61DAFB'       },
]

---

## OPERATION 3 — Update the NavItem 'section' type to include 'mantle'

### FIND

  section:  'intelligence' | 'agent' | 'binance' | 'tools'

### REPLACE WITH

  section:  'intelligence' | 'agent' | 'binance' | 'tools' | 'mantle'

---

## VERIFICATION
After applying:
- The sidebar should show a new "Mantle Agent" section with a ⬡ icon and "NEW" badge.
- Clicking it should navigate to the 'mantle-agent' tab (wired in app/page.tsx patch).
- TypeScript should compile without errors (section type union updated).

## NOTE
The 'mantle' section gets its own color (#61DAFB — Mantle cyan) to visually
distinguish it from the existing Trading Agent (yellow) section.
