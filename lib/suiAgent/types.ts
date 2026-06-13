/**
 * lib/suiAgent/types.ts
 * Re-exports and additional types for the Sui agent module — Session J.
 */

export type {
  SuiAgentConfig,
  SuiAgentDecision,
  SuiAgentSession,
  SuiAgentStatus,
  SuiCycleResult,
  SuiSignalSnapshot,
  SuiTradeRecord,
  SuiTradeAction,
  SuiTradeStatus,
  SuiWalletState,
} from '../sui/types'

export {
  DEFAULT_SUI_AGENT_CONFIG,
  INITIAL_WALLET_STATE,
  INITIAL_AGENT_SESSION,
} from '../sui/types'

export type { SuiAgentCallbacks } from './agentLoop'
export { SuiAgentLoop, adaptSignalSnapshot, formatSUI } from './agentLoop'
