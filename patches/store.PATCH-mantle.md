# Patch — lib/store.ts
# Session N3 · Add 'mantle-agent' to the ActiveTab union type
# FIND/REPLACE — apply once in lib/store.ts

## WHY
The ActiveTab union drives the tab routing in app/page.tsx.
Adding 'mantle-agent' here makes TypeScript aware of the new tab.

## FIND (exact text, including the surrounding lines for context)

  | 'backtest'

## REPLACE WITH

  | 'backtest'
  // ── Mantle AI Trading Agent (Session N) ───────────────────────────────────
  | 'mantle-agent'

## VERIFICATION
After applying, search for 'ActiveTab' in lib/store.ts.
The union should now include '| mantle-agent' after '| backtest'.
TypeScript should compile without errors.

## NOTE
No other change is needed in store.ts.
The Mantle agent uses its own isolated store (lib/mantleAgentStore.ts)
and does NOT add any fields to the main OpenClawStore.
