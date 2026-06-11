/**
 * lib/agentLoop.ts — Hotfix 7 patch
 * ADD these two lines at the top of your existing agentLoop.ts,
 * right after the existing imports:
 *
 *   export { COMPETITION_RULES } from './twak/client'
 *
 * This re-exports COMPETITION_RULES so both import paths work:
 *   import { COMPETITION_RULES } from '@/lib/twak/client'   ← direct (correct)
 *   import { COMPETITION_RULES } from '@/lib/agentLoop'     ← via re-export (also works)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Also add/confirm these constants are exported from agentLoop.ts:
 *
 *   export const DRAWDOWN_WARN_PCT  = COMPETITION_RULES.MAX_DRAWDOWN_PCT * 0.8
 *   export const DRAWDOWN_PAUSE_PCT = COMPETITION_RULES.MAX_DRAWDOWN_PCT * 0.933
 *
 * They're used in DrawdownGauge, CompetitionTab, and useAgentLoop.
 */

// This file is instructions only — apply the change to your agentLoop.ts
export {}
