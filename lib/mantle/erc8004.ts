/**
 * lib/mantle/erc8004.ts — Session N2 · ETHERS-FIX
 * Fixed: ethers.utils.defaultAbiCoder → ethers.AbiCoder.defaultAbiCoder() (v6 API)
 *
 * ERC-8004 (Trustless Agents) Identity Registry integration for Mantle.
 * Part of: The Turing Test Hackathon — defining feature #2:
 * "Every participating AI agent is issued a unique identity NFT via ERC-8004."
 *
 * Mirrors the pattern of lib/celo/erc8004.ts but targets Mantle Mainnet.
 * Fully independent — does not import from lib/celo/ or any existing file.
 *
 * The agent registration file is embedded fully on-chain as a
 * data:application/json;base64,... URI — no IPFS or external hosting needed.
 *
 * Network note: ERC-8004 registration is mainnet-only. The UI in
 * MantleAgentTab.tsx (Session N3) disables the Register button on testnet.
 */

import { ethers }          from 'ethers'
import { MantleClient }    from './client'
import type { MantleNetwork } from './config'
import {
  ERC8004_REGISTRY_MANTLE,
  EIGHT004SCAN_MANTLE_URL,
  MANTLE_MAINNET_CHAIN_ID,
} from './config'

// ─────────────────────────────────────────────────────────────────────────────
// ABI — minimal ERC-8004 Identity Registry interface
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY_REGISTRY_ABI = [
  'function register(string agentURI, tuple(string key, bytes value)[] metadata) external returns (uint256 agentId)',
  'function ownerOf(uint256 agentId) view returns (address)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]

// ─────────────────────────────────────────────────────────────────────────────
// Registration file builder
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleAgentRegistrationInfo {
  name:         string
  description:  string
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
        chainId: MANTLE_MAINNET_CHAIN_ID,
      },
    ],
    // Hackathon tracking tag
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
 * Register the MantleClient's wallet as an ERC-8004 agent identity on
 * Mantle Mainnet. Returns the minted agentId (ERC-721 tokenId).
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

  try {
    const regFile  = buildMantleRegistrationFile({
      name:          info.name,
      description:   info.description,
      walletAddress: address,
    })
    const agentURI = toDataURI(regFile)

    // ABI-encode wallet address as metadata (per ERC-8004 spec)
    const metadata = [
      {
        key:   'agentWallet',
        value: ethers.AbiCoder.defaultAbiCoder().encode(['address'], [address]),
      },
    ]

    const wallet   = client.getWallet()
    if (!wallet) return { success: false, error: 'No signer available.' }

    const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, wallet)
    const tx       = await registry.register(agentURI, metadata, { gasLimit: 600_000 })
    const receipt  = await tx.wait(1)

    // Parse agentId from Transfer event (ERC-721 mint: from === 0x0)
    let agentId: string | undefined
    for (const log of receipt.logs ?? []) {
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
      txHash:   receipt.transactionHash,
      agentURI,
      scanUrl:  agentId ? EIGHT004SCAN_MANTLE_URL(agentId) : undefined,
    }
  } catch (err: any) {
    console.error('[Mantle ERC-8004 registerMantleAgent]', err.message)
    return { success: false, error: err.message }
  }
}
