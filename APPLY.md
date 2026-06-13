# Session K — Move Policy Wallet + Sui Agent UI
## Apply Guide

### What this session adds
6 new files. Zero changes to any existing Binalyst file.

### Prerequisite
Session J files must already be in your project:
  - lib/sui/client.ts
  - lib/sui/types.ts
  - lib/walrus/client.ts
  - lib/walrus/memwal.ts
  - lib/suiAgent/agentLoop.ts
  - lib/suiAgent/types.ts

### Files to copy into your project

```
lib/movePolicy/client.ts              → create lib/movePolicy/ folder, copy in
lib/store.sui.ts                      → copy into lib/
app/api/sui/wallet/route.ts           → create app/api/sui/wallet/ folder, copy in
app/api/sui/policy/route.ts           → create app/api/sui/policy/ folder, copy in
app/api/sui/agent/route.ts            → create app/api/sui/agent/ folder, copy in
components/tabs/SuiAgentTab.tsx       → copy into components/tabs/
```

### Apply order
1. Create folders:
   - lib/movePolicy/
   - app/api/sui/wallet/
   - app/api/sui/policy/
   - app/api/sui/agent/
2. Copy all 6 files
3. No existing file is modified

### Wire the tab into the sidebar (OPTIONAL — only if you want it visible now)
These are the ONLY two lines that touch existing files.
If you prefer to wait until Session M to wire everything in, skip this step.

In app/page.tsx — add to tab imports:
```tsx
// ADD this import alongside other tab imports
import SuiAgentTab from '@/components/tabs/SuiAgentTab'
```

In app/page.tsx — add to the tabs array/switch:
```tsx
// ADD alongside other tab cases
case 'sui-agent': return <SuiAgentTab />
```

In components/Sidebar.tsx — add to nav items array:
```tsx
// ADD alongside other nav items
{ id: 'sui-agent', label: 'Sui Agent', icon: '⛓️' }
```

If you skip the sidebar wiring, the tab exists but won't appear until you add it.
The tab can always be accessed directly at any time.

### Environment variables (add to .env.local)
```
# Set after deploying the Move policy package (Session M)
NEXT_PUBLIC_POLICY_PACKAGE_ID=
```
Leave blank for now — the client defaults to dry-run simulation mode.

### Verification
After copying files:
```bash
npx tsc --noEmit
```
Zero errors expected.

### What Session L adds (next)
- lib/deepbook/client.ts        — DeepBook order book client
- lib/deepbook/types.ts         — Order, Pool, Fill types
- app/api/deepbook/order/route.ts — Place/cancel orders
- app/api/deepbook/pools/route.ts — Fetch available pools
- components/tabs/DeepBookTab.tsx — Live order book UI
- Walrus blob write per agent decision (on-chain activity log)
  → wired into SuiAgentTab's executeTrade callback (new file, not editing existing)
