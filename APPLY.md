# Session M — Move Contract + Revocation Demo + Submission
## Apply Guide — FINAL SESSION

### What this session adds
5 new files. The sidebar wiring (2 additive lines in 2 existing files) is
the only optional touch to existing code — described in SIDEBAR_WIRING.ts.

### Prerequisites
Sessions J, K, and L files must already be in your project.

### Files to copy into your project

```
move/Move.toml                           → create move/ folder at project root, copy in
move/sources/agent_policy.move           → create move/sources/ folder, copy in
move/tests/agent_policy_tests.move       → create move/tests/ folder, copy in
app/api/sui/revoke/route.ts              → create app/api/sui/revoke/ folder, copy in
components/tabs/RevocationDemo.tsx       → copy into components/tabs/
docs/SUBMISSION.md                       → create docs/ folder, copy in (hackathon submission)
```

### Apply order
1. Create folders: move/sources/, move/tests/, app/api/sui/revoke/, docs/
2. Copy all 5 files
3. Optionally apply sidebar wiring (see SIDEBAR_WIRING.ts)

### Deploy the Move package (required for live demo)
```bash
# Install Sui CLI: https://docs.sui.io/guides/developer/getting-started/sui-install
cd move/
sui client switch --env testnet
sui client publish --gas-budget 100000000
```
From the output, copy the published package ID.
Set it in .env.local:
```
NEXT_PUBLIC_POLICY_PACKAGE_ID=0x<your-package-id>
```

### Run Move tests (no deploy needed)
```bash
cd move/
sui move test
# Expect: 9 tests passed
```

### Full environment variables (.env.local)
```
# From Session J (optional — for MemWal memory layer)
MEMWAL_API_KEY=
MEMWAL_API_URL=https://api.memwal.ai

# From Session M (required for live on-chain policy)
NEXT_PUBLIC_POLICY_PACKAGE_ID=0x<your-package-id>

# Your existing Binalyst env vars are unchanged
```

### Verification
```bash
npx tsc --noEmit   # zero errors
cd move && sui move test   # 9 tests pass
npm run dev        # app starts, all tabs accessible
```

### Complete file inventory across all sessions

Session J (6 files):
  lib/sui/client.ts
  lib/sui/types.ts
  lib/walrus/client.ts
  lib/walrus/memwal.ts
  lib/suiAgent/agentLoop.ts
  lib/suiAgent/types.ts

Session K (6 files):
  lib/movePolicy/client.ts
  lib/store.sui.ts
  app/api/sui/wallet/route.ts
  app/api/sui/policy/route.ts
  app/api/sui/agent/route.ts
  components/tabs/SuiAgentTab.tsx

Session L (7 files):
  lib/deepbook/types.ts
  lib/deepbook/client.ts
  lib/walrus/activityLog.ts
  app/api/deepbook/order/route.ts
  app/api/deepbook/pools/route.ts
  app/api/walrus/log/route.ts
  components/tabs/DeepBookTab.tsx

Session M (5 files + optional wiring):
  move/Move.toml
  move/sources/agent_policy.move
  move/tests/agent_policy_tests.move
  app/api/sui/revoke/route.ts
  components/tabs/RevocationDemo.tsx
  docs/SUBMISSION.md

Total: 24 new files. 0 existing files modified.
Optional: 6 additive lines across 2 existing files (sidebar wiring).
