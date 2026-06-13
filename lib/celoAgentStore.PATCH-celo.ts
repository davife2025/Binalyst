// lib/celoAgentStore.PATCH-celo.ts — Session M
//
// Adds ERC-8004 identity fields (agentId, registrationTxHash) to
// celoAgentStore.ts. This zip includes the FULL updated
// lib/celoAgentStore.ts (Session K's version + these additions) — you can
// either drop it in directly, or apply the 3 small diffs below to your
// Session K copy if you've already customized it.
//
// ─────────────────────────────────────────────────────────────────────────
// 1. Interface additions (after `cusdBalance: number`):
// ─────────────────────────────────────────────────────────────────────────
//
//   // ── ERC-8004 identity (Session M — Track 3) ───────────────────────────────
//   agentId:            string | null   // ERC-8004 agentId (ERC-721 tokenId) on Celo Mainnet
//   registrationTxHash: string | null
//   setAgentIdentity:   (agentId: string, txHash: string) => void
//
// ─────────────────────────────────────────────────────────────────────────
// 2. State + setter (after `setCusdBalance: (bal) => set({ cusdBalance: bal }),`):
// ─────────────────────────────────────────────────────────────────────────
//
//   // ── ERC-8004 identity ────────────────────────────────────────────────
//   agentId:            null,
//   registrationTxHash: null,
//   setAgentIdentity: (agentId, txHash) =>
//     set({ agentId, registrationTxHash: txHash }),
//
// ─────────────────────────────────────────────────────────────────────────
// 3. Persist in `partialize` (after `payments: s.payments.slice(0, 100),`):
// ─────────────────────────────────────────────────────────────────────────
//
//   agentId:            s.agentId,
//   registrationTxHash: s.registrationTxHash,
//
// ─────────────────────────────────────────────────────────────────────────
