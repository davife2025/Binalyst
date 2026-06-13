# Patch — lib/skills/index.ts
# Session N4 · Add Byreal skill exports
# ONE FIND/REPLACE operation.

## OPERATION — Append Byreal exports at the end of the file

### FIND (exact text — the last line of lib/skills/index.ts)

} from './cmc'

### REPLACE WITH

} from './cmc'

// ── Byreal Skills — Mantle AI Trading Agent (Session N4) ─────────────────────
// Agentic Wallets & Economy track — The Turing Test Hackathon
export {
  BYREAL_SKILLS,
  ByrealSkillHub,
  mantleGetPriceSkill,
  mantleSignalScoreSkill,
  mantleRunCycleSkill,
  mantleBenchmarkInfoSkill,
  mantleAgentIdentitySkill,
} from './byreal'

export type {
  ByrealSkill,
  ByrealSkillParam,
  ByrealSkillResult,
} from './byreal'

---

## VERIFICATION
After applying:
- `import { ByrealSkillHub } from '@/lib/skills'` should resolve correctly.
- `ByrealSkillHub.skills.length` should equal 5.
- TypeScript should compile without errors.

## NOTE
The file lib/skills/byreal.ts (new, from this session) must be in place
before applying this patch, or TypeScript will error on the missing module.
Drop lib/skills/byreal.ts first, then apply this patch.
