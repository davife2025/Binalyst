// lib/store.ts — PATCH for Session A
// Add 'agent-wallet' to the activeTab union type.
// Replace the activeTab type line in your existing store.ts:
//
//   activeTab: 'home' | 'messaging' | 'chat' | 'markets' | 'events' | 'learn' |
//              'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' |
//              'settings' | 'agent-wallet'
//
// And add it to setActiveTab's parameter type identically.
//
// No other changes needed in store.ts for Session A.
//
// ─────────────────────────────────────────────────────────────────────────────
// DIFF — only the type line changes:
// ─────────────────────────────────────────────────────────────────────────────
//
// BEFORE:
//   activeTab: 'home' | 'messaging' | 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'settings'
//
// AFTER:
//   activeTab: 'home' | 'messaging' | 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'settings' | 'agent-wallet'
//
// Apply the same change to setActiveTab's parameter type.
export {}
