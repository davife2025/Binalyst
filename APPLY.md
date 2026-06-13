# Session J — Sui Foundations
## Apply Guide

### What this session adds
Pure new files only. Zero changes to any existing Binalyst file.

### Files to copy into your project

```
lib/sui/client.ts          → copy as-is into your lib/sui/ folder (create it)
lib/sui/types.ts           → copy as-is into lib/sui/
lib/walrus/client.ts       → copy as-is into lib/walrus/ (create it)
lib/walrus/memwal.ts       → copy as-is into lib/walrus/
lib/suiAgent/agentLoop.ts  → copy as-is into lib/suiAgent/ (create it)
lib/suiAgent/types.ts      → copy as-is into lib/suiAgent/
```

### Apply order
1. Create folders: `lib/sui/`, `lib/walrus/`, `lib/suiAgent/`
2. Copy all 6 files in
3. No package.json changes needed — all Sui RPC calls use the native `fetch` API
4. No existing file is modified

### Environment variables to add (optional for Session J, required for Session L+)
Add to your `.env.local`:
```
# Walrus memory (get key from https://docs.memwal.ai/)
MEMWAL_API_KEY=
MEMWAL_API_URL=https://api.memwal.ai
```
Leave blank for now — the client gracefully skips writes when the key is absent.

### Verification
After copying files, run:
```bash
npx tsc --noEmit
```
Should produce zero errors related to the new files.

### What Session K adds (next)
- `components/tabs/SuiAgentTab.tsx` — new sidebar tab with wallet connect + agent status
- `app/api/sui/wallet/route.ts` — balance endpoint
- `app/api/sui/agent/route.ts` — agent control endpoint
- `lib/store.sui.ts` — isolated Zustand slice (no changes to store.ts)
- Two additive lines in `app/page.tsx` and `components/Sidebar.tsx`
