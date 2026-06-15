# Session N — Bug fixes, hook, env, deploy script, Showcase
## Apply Guide

### What this session fixes / adds
8 changes total. 3 replace existing files, 5 are new files.

### Files to REPLACE (patch existing files)

```
lib/store.sui.ts
  → replaces existing (removes unused INITIAL_AGENT_SESSION + DEFAULT_POLICY imports)

components/tabs/SuiAgentTab.tsx
  → replaces existing (removes unused useEffect + checkPolicyAllowsTrade imports)

move/sources/agent_policy.move
  → replaces existing (Move 2024.beta syntax — ctx.sender(), ctx.epoch(),
    public struct instead of struct, vector methods as methods not functions)
```

### New files to ADD

```
hooks/useSuiAgentLoop.ts
  → create hooks/ if not exists, copy in
  → mirrors useCeloAgentLoop.ts pattern exactly
  → extracts the agent loop logic from SuiAgentTab into a reusable hook

.env.sui.example
  → copy to project root alongside .env.celo.example and .env.mantle.example
  → documents NEXT_PUBLIC_POLICY_PACKAGE_ID, MEMWAL_API_KEY, network options

scripts/deploy-sui.sh
  → copy to scripts/ folder (create if not exists)
  → run: bash scripts/deploy-sui.sh
  → deploys Move package, captures ID, writes to .env.local automatically

Showcase.md
  → replaces existing (Sui section appended at end)
  → covers architecture, sub-track requirements, why Sui, onchain proof

docs/SUBMISSION.md
  → already in repo from Session M — no change needed
```

### Apply order
1. Replace 3 existing files
2. Add 4 new files
3. Make deploy script executable: chmod +x scripts/deploy-sui.sh

### Verification
```bash
npx tsc --noEmit       # zero TS warnings from unused imports
cd move && sui move test   # 9 tests pass with new Move 2024 syntax
bash scripts/deploy-sui.sh # deploys to testnet, writes package ID
```

### Move 2024.beta changes summary
Old syntax (broken):          New syntax (fixed):
  struct Foo has key {}    →    public struct Foo has key {}
  tx_context::sender(ctx)  →    ctx.sender()
  tx_context::epoch(ctx)   →    ctx.epoch()
  vector::push_back(&mut v, x) → v.push_back(x)
  vector::is_empty(&v)     →    v.is_empty()
  vector::contains(&v, &x) →    v.contains(&x)

### Complete final apply order (entire build)
1. Session J    → 6 new lib files
2. Session K    → 6 new files
3. Session L    → 7 new files
4. Session M    → Move contract + revoke API + docs
5. Session Wire → replace store.ts, page.tsx, Sidebar.tsx
6. Session UI   → replace 3 tab files
7. Session N    → THIS SESSION (3 replacements + 4 new files)
8. Deploy:      bash scripts/deploy-sui.sh
