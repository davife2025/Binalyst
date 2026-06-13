# Patch — components/MobileDrawer.tsx
# Session N3 · Add Mantle AI Trading Agent to the mobile drawer
# ONE FIND/REPLACE operation.

## OPERATION — Append Mantle section to the SECTIONS array

### FIND (exact text — the closing bracket of the SECTIONS array, after the Tools section)

      { id: 'messaging', label: 'Messaging',    icon: '📱', desc: 'Telegram & WhatsApp bot' },
    ],
  },
]

### REPLACE WITH

      { id: 'messaging', label: 'Messaging',    icon: '📱', desc: 'Telegram & WhatsApp bot' },
    ],
  },
  // ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ───────
  {
    label: 'Mantle Agent',
    color: '#61DAFB',
    items: [
      { id: 'mantle-agent', label: 'Mantle Agent', icon: '⬡', desc: 'AI trading · on-chain benchmarking · ERC-8004' },
    ],
  },
]

---

## VERIFICATION
After applying:
- The mobile hamburger drawer should show a "Mantle Agent" section at the bottom
  with a cyan (#61DAFB) section header color.
- Tapping the ⬡ Mantle Agent item should navigate to 'mantle-agent' tab.

## NOTE
MobileDrawer uses a DrawerSection type that requires: label, color, items[].
Each item requires: id (ActiveTab), label, icon, desc.
'mantle-agent' is now a valid ActiveTab after the store.ts patch above.
