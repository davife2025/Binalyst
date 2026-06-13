# Session L — DeepBook Execution + Walrus Activity Log
## Apply Guide

### What this session adds
7 new files. Zero changes to any existing Binalyst file.

### Prerequisites
Session J and Session K files must already be in your project.

### Files to copy into your project

```
lib/deepbook/types.ts                 → create lib/deepbook/ folder, copy in
lib/deepbook/client.ts                → copy into lib/deepbook/
lib/walrus/activityLog.ts             → copy into lib/walrus/ (already exists from Session J)
app/api/deepbook/order/route.ts       → create app/api/deepbook/order/ folder, copy in
app/api/deepbook/pools/route.ts       → create app/api/deepbook/pools/ folder, copy in
app/api/walrus/log/route.ts           → create app/api/walrus/log/ folder, copy in
components/tabs/DeepBookTab.tsx       → copy into components/tabs/
```

### Apply order
1. Create folders:
   - lib/deepbook/
   - app/api/deepbook/order/
   - app/api/deepbook/pools/
   - app/api/walrus/log/
2. Copy all 7 files
3. No existing file is modified

### Wire the DeepBook tab (OPTIONAL — same as SuiAgentTab wiring)
In app/page.tsx:
```tsx
import DeepBookTab from '@/components/tabs/DeepBookTab'
// ...
case 'deepbook': return <DeepBookTab />
```

In components/Sidebar.tsx:
```tsx
{ id: 'deepbook', label: 'DeepBook', icon: '📊' }
```

### How the activity log works
Every dry-run or live order placed through the agent or the DeepBook tab:
1. Calls POST /api/deepbook/order
2. The route calls simulatePlaceOrder() → logOrderPlaced()
3. logOrderPlaced() calls walrusStoreJson() → Walrus testnet publisher
4. Returns a blobId stored on the order record
5. Anyone can verify the log entry at:
   https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}

This is the on-chain activity log the Sub-track 2 judges require.

### Verification
```bash
npx tsc --noEmit
```
Zero errors expected.

### What Session M adds (final)
- Move package source (agent_policy.move) for on-chain deployment
- Owner revocation demo flow
- Full hackathon submission README
- Demo script (step-by-step for judges)
- Optional: sidebar wiring for all Sui tabs in one patch
