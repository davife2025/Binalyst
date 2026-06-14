# Session UI — Design system fix
## Apply Guide

### Root cause
The original Sui tabs used CSS variables from the Claude/Anthropic design system
(--color-text-primary, --color-background-secondary, --color-border-tertiary, etc.)
These variables DO NOT EXIST in Binalyst. The app uses its own dark theme:
  --bg / --bg2 / --bg3 / --bg4       (backgrounds)
  --text / --text2 / --text3          (text)
  --border / --border2                (borders)
  --yellow / --green / --red          (accents)
  .mono class                         (Space Mono font)
  Tailwind utility classes            (layout)
  Syne font (default)                 (body font)

### Files to replace (replace ALL 3 — they supersede Session K, L, M AND Session Fix versions)

```
components/tabs/SuiAgentTab.tsx    → replaces Session K + Fix versions
components/tabs/DeepBookTab.tsx    → replaces Session L + Fix versions
components/tabs/RevocationDemo.tsx → replaces Session M version
```

### What changed in each file
SuiAgentTab.tsx:
  - All var(--color-*) → var(--bg*) / var(--text*) / var(--yellow) / var(--green) / var(--red)
  - Added Tailwind layout classes (flex, grid, gap, rounded-xl, px-*, py-*)
  - Added .mono class for Space Mono font on all code/data text
  - Buttons styled to match Binalyst yellow primary / ghost / danger pattern
  - Cards use --bg2 background + --border border (matches existing tabs)
  - Already includes the executeTrade DeepBook wiring and CMC fix from Session Fix

DeepBookTab.tsx:
  - Same design system conversion
  - Order book rows use subtle rgba(--green/--red, 0.07) bar fills
  - Already includes dead policy prop removal from Session Fix

RevocationDemo.tsx:
  - Same design system conversion
  - Kill switch button matches Binalyst danger pattern
  - Move event display uses --bg3 + mono font (matches existing code blocks)

### Final apply order (complete build)
1. Session J
2. Session K
3. Session L
4. Session M
5. Session Wire (store.ts, page.tsx, Sidebar.tsx)
6. Session UI ← THIS SESSION (replaces K+L+M tab files + Fix)
7. Deploy Move package
8. Set NEXT_PUBLIC_POLICY_PACKAGE_ID
