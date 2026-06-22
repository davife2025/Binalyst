/**
 * lib/mantle/erc8004.ts — Session N2 · ERC8004-FIX
 *
 * ROOT CAUSE OF REVERT:
 * We were calling register(string agentURI, tuple[] metadata) — a two-argument
 * function that doesn't exist on the deployed contract.
 *
 * ACTUAL deployed contract ABI (from erc-8004/erc-8004-contracts):
 *
 *   function register(string calldata tokenURI_) external returns (uint256)
 *
 * Single argument — just the tokenURI string. No metadata tuple array.
 * The contract also emits: event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)
 *
 * FIX:
 *  1. Updated ABI to single-arg register(string)
 *  2. Registration file encoded as data: URI — passed directly as tokenURI
 *  3. Parse agentId from Registered event (not Transfer event)
 *  4. Removed ethers.AbiCoder call entirely (no metadata encoding needed)
 *  5. Added fallback: also try to parse agentId from Transfer event
 *
 * Everything else (addresses, network guard, registration file format) unchanged.
 */

import { ethers }         from 'ethers'
import { MantleClient }   from './client'
import {
  ERC8004_REGISTRY_MANTLE,
  EIGHT004SCAN_MANTLE_URL,
} from './config'

// ─────────────────────────────────────────────────────────────────────────────
// ABI — correct single-arg register function
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY_REGISTRY_ABI = [
  // CORRECT: single string argument — tokenURI only
  'function register(string calldata tokenURI_) external returns (uint256)',
  'function ownerOf(uint256 agentId) view returns (address)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  // Events
  'event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]

// ─────────────────────────────────────────────────────────────────────────────
// Registration file builder
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleAgentRegistrationInfo {
  name:          string
  description:   string
  walletAddress: string
}

export function buildMantleRegistrationFile(info: MantleAgentRegistrationInfo) {
  return {
    type:        'Agent',
    name:        info.name,
    description: info.description,
    endpoints: [
      {
        type:    'wallet',
        address: info.walletAddress,
        chainId: 5000,   // Mantle Mainnet
      },
    ],
    tags: ['turing-test-hackathon', 'ai-trading', 'mantle'],
    supportedTrust: ['reputation'],
  }
}

/** Encode a registration object as a fully on-chain data: URI. */
export function toDataURI(obj: object): string {
  const json   = JSON.stringify(obj)
  const base64 = Buffer.from(json, 'utf-8').toString('base64')
  return `data:application/json;base64,${base64}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterMantleAgentResult {
  success:   boolean
  agentId?:  string
  txHash?:   string
  agentURI?: string
  scanUrl?:  string
  error?:    string
}

/**
 * Register the MantleClient's wallet as an ERC-8004 agent on Mantle Mainnet.
 *
 * The contract's register() takes a single tokenURI string.
 * We encode the registration file as an on-chain data: URI and pass it directly.
 */
export async function registerMantleAgent(
  client: MantleClient,
  info: { name: string; description: string },
): Promise<RegisterMantleAgentResult> {
  // Guard: mainnet only
  if (client.network !== 'mainnet') {
    return {
      success: false,
      error:   `ERC-8004 registration requires Mantle Mainnet. Current network: ${client.network}.`,
    }
  }

  const registryAddress = ERC8004_REGISTRY_MANTLE[client.network]
  if (!registryAddress) {
    return {
      success: false,
      error:   'ERC-8004 Identity Registry address not configured for Mantle mainnet.',
    }
  }

  const address = client.getAddress()
  if (!address) {
    return { success: false, error: 'No wallet loaded.' }
  }

  const wallet = client.getWallet()
  if (!wallet) {
    return { success: false, error: 'No signer available.' }
  }

  try {
    // Build the registration file and encode it as a data: URI
    const regFile  = buildMantleRegistrationFile({
      name:          info.name,
      description:   info.description,
      walletAddress: address,
    })
    const agentURI = toDataURI(regFile)

    // Connect to the registry
    const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, wallet)

    // ── FIXED: single-arg call ──────────────────────────────────────────────
    const tx      = await registry.register(agentURI, { gasLimit: 300_000 })
    const receipt = await tx.wait(1)

    // Parse agentId — try Registered event first, then Transfer event
    let agentId: string | undefined

    for (const log of receipt.logs ?? []) {
      try {
        const parsed = registry.interface.parseLog(log)
        if (!parsed) continue

        if (parsed.name === 'Registered') {
          // event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)
          agentId = parsed.args.agentId.toString()
          break
        }

        if (parsed.name === 'Transfer' && !agentId) {
          // ERC-721 mint: from === zero address
          const from = parsed.args.from as string
          if (from === ethers.ZeroAddress || from === '0x0000000000000000000000000000000000000000') {
            agentId = parsed.args.tokenId.toString()
          }
        }
      } catch {
        // log doesn't match this contract's ABI — skip
      }
    }

    return {
      success:  true,
      agentId,
      txHash:   receipt.hash,
      agentURI,
      scanUrl:  agentId ? EIGHT004SCAN_MANTLE_URL(agentId) : undefined,
    }
  } catch (err: any) {
    console.error('[Mantle ERC-8004 registerMantleAgent]', err.message)
    return { success: false, error: err.message }
  }
}
