/**
 * lib/store.ts — Session E final patch
 * ONLY the activeTab type needs updating. Replace the existing union with this one.
 *
 * Find this line in your store.ts:
 *   activeTab: 'home' | 'messaging' | ...
 *
 * Replace with the full union below (both in the interface AND in the initial state).
 */

export type ActiveTab =
  | 'home'
  | 'chat'
  | 'markets'
  | 'events'
  | 'learn'
  | 'portfolio'
  | 'trading'
  | 'alerts'
  | 'agent'
  | 'web3'
  | 'square'
  | 'messaging'
  | 'settings'
  // Sessions A-E:
  | 'agent-wallet'
  | 'signals'
  | 'strategy'
  | 'competition'
  | 'submission'

/**
 * In store.ts, update:
 *
 * interface OpenClawStore {
 *   ...
 *   activeTab: ActiveTab          ← change this
 *   setActiveTab: (tab: ActiveTab) => void  ← and this
 *   ...
 * }
 *
 * Import ActiveTab from here, or just paste the union directly.
 *
 * No other store changes needed for Session E.
 */
