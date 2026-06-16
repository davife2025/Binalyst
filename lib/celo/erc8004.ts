/**
 * lib/celo/erc8004.ts — Session M (new file)
 *
 * ERC-8004 (Trustless Agents) Identity Registry integration — Onchain
 * Agents Hackathon Track 3 (Highest Rank in 8004scan for Celo).
 *
 * Registers the Celo Payments Agent's wallet as an ERC-8004 agent identity
 * (an ERC-721 NFT) on Celo Mainnet, so it's discoverable on 8004scan.
 *
 * IMPORTANT — Network support:
 *  - ERC-8004 is deployed on CELO MAINNET (chainId 42220) at the address
 *    below, per Celo's official docs (docs.celo.org/build-on-celo/
 *    build-with-ai/8004), June 2026.
 *  - It is NOT deployed on Alfajores (chainId 44787). A separate "Celo
 *    Sepolia" testnet has its own deployment, but that's a different chain
 *    from Alfajores and isn't part of this agent's CeloNetwork union.
 *  - registerAgent() therefore only works when network === 'mainnet'.
 *
 * The agent registration file is embedded directly on-chain as a
 * base64 `data:` URI (per the ERC-8004 spec, agentURI MAY be a
 * data:application/json;base64,... URI) — no IPFS/hosting dependency.
 */

import { ethers } from 'ethers'
import { CeloClient } from './client'
import type { CeloNetwork } from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Contract addresses
// ─────────────────────────────────────────────────────────────────────────────

export const ERC8004_IDENTITY_REGISTRY: Record<CeloNetwork, string | null> = {
  mainnet:   '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  alfajores: null, // not deployed — see notes above
}

export const EIGHT004SCAN_BASE_URL = 'https://8004scan.io'

export function get8004ScanUrl(agentId: string | number): string {
  return `${EIGHT004SCAN_BASE_URL}/agents/celo/${agentId}`
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI
// ─────────────────────────────────────────────────────────────────────────────

// ABI sourced from erc-8004/erc-8004-contracts (IdentityRegistryUpgradeable).
// register() mints an ERC-721 NFT. agentWallet is set automatically to
// msg.sender — do NOT pass it in metadata (causes revert). Pass [] instead.
const IDENTITY_REGISTRY_ABI = [
  'function register(string calldata agentURI, tuple(string key, bytes value)[] calldata metadata) external returns (uint256 agentId)',
  'function ownerOf(uint256 agentId) view returns (address)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]

// ─────────────────────────────────────────────────────────────────────────────
// Registration file (ERC-8004 spec: agentURI -> registration file)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentRegistrationInfo {
  name:        string
  description: string
  walletAddress: string
  chainId:     number
}

export function buildRegistrationFile(info: AgentRegistrationInfo) {
  return {
    type: 'Agent',
    name: info.name,
    description: info.description,
    endpoints: [
      {
        type:    'wallet',
        address: info.walletAddress,
        chainId: info.chainId,
      },
    ],
    supportedTrust: ['reputation'],
  }
}

/** Encode a registration file as a fully on-chain `data:` URI (no IPFS needed). */
export function toDataURI(registrationFile: object): string {
  const json = JSON.stringify(registrationFile)
  const base64 = Buffer.from(json, 'utf-8').toString('base64')
  return `data:application/json;base64,${base64}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterAgentResult {
  success:  boolean
  agentId?: string
  txHash?:  string
  agentURI?: string
  scanUrl?: string
  error?:   string
}

/**
 * Register the CeloClient's wallet as an ERC-8004 agent identity on Celo
 * Mainnet. Returns the minted agentId (ERC-721 tokenId) parsed from the
 * Transfer event in the transaction receipt.
 */
export async function registerAgent(
  client: CeloClient,
  info: { name: string; description: string }
): Promise<RegisterAgentResult> {
  const registryAddress = ERC8004_IDENTITY_REGISTRY[client.network]
  if (!registryAddress) {
    return {
      success: false,
      error: `ERC-8004 Identity Registry is not deployed on Celo ${client.network}. Switch to Celo Mainnet to register.`,
    }
  }

  try {
    const registrationFile = buildRegistrationFile({
      name:          info.name,
      description:   info.description,
      walletAddress: client.address,
      chainId:       client.getChainId(),
    })
    const agentURI = toDataURI(registrationFile)

    // Per spec: agentWallet is set automatically to msg.sender on registration.
    // Passing it in the metadata array causes a revert. Pass empty array.
    const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, client.getWallet())

    const tx  = await registry.register(agentURI, [], { gasLimit: 500_000 })
    const rec = await tx.wait()

    // Parse agentId from the Transfer event (ERC-721 mint: from = 0x0)
    let agentId: string | undefined
    for (const log of rec.logs ?? []) {
      try {
        const parsed = registry.interface.parseLog(log)
        if (parsed?.name === 'Transfer') {
          agentId = parsed.args.tokenId.toString()
          break
        }
      } catch {
        // not a Transfer log from this contract — skip
      }
    }

    return {
      success:  true,
      agentId,
      txHash:   rec.hash,
      agentURI,
      scanUrl:  agentId ? get8004ScanUrl(agentId) : undefined,
    }
  } catch (err: any) {
    console.error('[Celo ERC-8004 registerAgent]', err.message)
    return { success: false, error: err.message }
  }
}
