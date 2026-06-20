/**
 * lib/pokt/skills.ts — Session P2 (new file)
 *
 * AI tool definitions + executor for the POKT Agent.
 * Powers natural-language on-chain queries routed through Pocket Network RPC.
 *
 * PURELY ADDITIVE — does not import from or modify any existing Binalyst file.
 *
 * Tools exposed to the AI:
 *   query_balance         → native token balance of any address on any chain
 *   query_erc20_balance   → ERC-20 token balance
 *   query_block           → latest or specific block info
 *   query_transaction     → transaction status & details
 *   query_contract        → is this address a contract? what size?
 *   query_gas             → current gas prices on any chain
 *   ping_chain            → health-check a chain's POKT RPC endpoint
 *   get_network_metrics   → live POKTscan stats (relays, nodes, CUs)
 *   list_supported_chains → enumerate all chains available via POKT
 *
 * Each tool returns a structured JSON result that the AI renders into
 * a natural-language response for the user.
 */

import { poktClient }             from './client'
import { getPOKTNetworkMetrics }  from './poktscan'
import { POKT_CHAIN_LIST, POKT_CHAINS } from './config'

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI-compatible tool definitions (works with any OpenAI-format SDK)
// ─────────────────────────────────────────────────────────────────────────────

export const POKT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_balance',
      description:
        'Get the native token balance (ETH, BNB, MATIC, etc.) of any wallet address on any POKT-supported chain. Use this when the user asks about a wallet balance, how much ETH/BNB someone holds, or checks a specific address.',
      parameters: {
        type: 'object',
        properties: {
          address:  { type: 'string', description: 'The wallet address to check (0x... for EVM)' },
          chainKey: { type: 'string', description: 'Chain to query: ethereum, bsc, polygon, arbitrum, optimism, base, avalanche, gnosis, solana, harmony', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','solana','harmony'] },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_erc20_balance',
      description:
        'Get the ERC-20 token balance of a wallet for a specific token contract. Use this when the user asks about USDC, USDT, or any specific token holding at an address.',
      parameters: {
        type: 'object',
        properties: {
          address:      { type: 'string', description: 'The wallet address' },
          tokenAddress: { type: 'string', description: 'The ERC-20 token contract address' },
          chainKey:     { type: 'string', description: 'Chain to query', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','harmony'] },
        },
        required: ['address', 'tokenAddress'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_block',
      description:
        'Get block data (number, timestamp, transaction count, gas) for any supported chain. Use "latest" for the current block or provide a specific block number.',
      parameters: {
        type: 'object',
        properties: {
          chainKey:  { type: 'string', description: 'Chain to query', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','harmony'] },
          blockTag:  { type: 'string', description: '"latest" or a specific block number as a string' },
        },
        required: ['chainKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_transaction',
      description:
        'Look up a specific transaction by hash. Returns status (success/failed/pending), value, from/to, gas used, and confirmations.',
      parameters: {
        type: 'object',
        properties: {
          hash:     { type: 'string', description: 'Transaction hash (0x...)' },
          chainKey: { type: 'string', description: 'Chain to query', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','harmony'] },
        },
        required: ['hash', 'chainKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_contract',
      description:
        'Check if an address is a smart contract (has deployed bytecode). Returns true/false and the bytecode size in bytes.',
      parameters: {
        type: 'object',
        properties: {
          address:  { type: 'string', description: 'Address to inspect' },
          chainKey: { type: 'string', description: 'Chain to query', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','harmony'] },
        },
        required: ['address', 'chainKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_gas',
      description:
        'Get current gas prices (in Gwei) on any EVM chain via POKT Network. Use when the user asks about gas fees or transaction costs.',
      parameters: {
        type: 'object',
        properties: {
          chainKey: { type: 'string', description: 'Chain to query', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','harmony'] },
        },
        required: ['chainKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ping_chain',
      description:
        'Health-check a specific chain\'s POKT RPC endpoint. Returns latency and the latest block number to confirm the node is live.',
      parameters: {
        type: 'object',
        properties: {
          chainKey: { type: 'string', description: 'Chain to ping', enum: ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','gnosis','solana','harmony'] },
        },
        required: ['chainKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_network_metrics',
      description:
        'Get live Pocket Network health metrics from POKTscan: relay count (24h), computed units (24h), active nodes, validators, staked POKT, and POKT token price.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_supported_chains',
      description:
        'List all blockchain networks currently supported via Pocket Network RPC, with their chain IDs and RPC endpoints.',
      parameters: {
        type: 'object',
        properties: {
          filterEVM: { type: 'boolean', description: 'If true, return only EVM-compatible chains' },
        },
      },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Tool executor
// ─────────────────────────────────────────────────────────────────────────────

export async function executePOKTTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {

    case 'query_balance': {
      const { address, chainKey = 'ethereum' } = args as { address: string; chainKey?: string }
      const chain = POKT_CHAINS[chainKey]

      // Solana uses a different balance method
      if (chainKey === 'solana') {
        const result = await poktClient.getSolanaBalance(address)
        return {
          ...result,
          chainName: 'Solana',
          symbol: 'SOL',
          via: 'pokt',
        }
      }

      return await poktClient.getBalance(address, chainKey)
    }

    case 'query_erc20_balance': {
      const { address, tokenAddress, chainKey = 'ethereum' } = args as {
        address: string
        tokenAddress: string
        chainKey?: string
      }
      return await poktClient.getERC20Balance(address, tokenAddress, chainKey)
    }

    case 'query_block': {
      const { chainKey = 'ethereum', blockTag = 'latest' } = args as {
        chainKey?: string
        blockTag?: string
      }
      const tag = blockTag === 'latest' ? 'latest' : parseInt(blockTag, 10)
      return await poktClient.getBlock(tag as 'latest' | number, chainKey)
    }

    case 'query_transaction': {
      const { hash, chainKey = 'ethereum' } = args as { hash: string; chainKey?: string }
      return await poktClient.getTransaction(hash, chainKey)
    }

    case 'query_contract': {
      const { address, chainKey = 'ethereum' } = args as { address: string; chainKey?: string }
      return await poktClient.isContract(address, chainKey)
    }

    case 'query_gas': {
      const { chainKey = 'ethereum' } = args as { chainKey?: string }
      return await poktClient.getGasPrice(chainKey)
    }

    case 'ping_chain': {
      const { chainKey } = args as { chainKey: string }
      return await poktClient.pingChain(chainKey)
    }

    case 'get_network_metrics': {
      const metrics = await getPOKTNetworkMetrics()
      return {
        ...metrics,
        note: 'Data sourced from poktscan.com — the authoritative POKT Network explorer.',
      }
    }

    case 'list_supported_chains': {
      const { filterEVM = false } = args as { filterEVM?: boolean }
      const chains = filterEVM
        ? POKT_CHAIN_LIST.filter(c => c.isEVM)
        : POKT_CHAIN_LIST
      return chains.map(c => ({
        id:       c.id,
        name:     c.name,
        chainId:  c.chainId,
        symbol:   c.symbol,
        rpcUrl:   c.rpcUrl,
        explorer: c.explorer,
        isEVM:    c.isEVM,
        category: c.category,
        icon:     c.icon,
      }))
    }

    default:
      throw new Error(`Unknown POKT tool: "${name}"`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt for the POKT AI agent
// ─────────────────────────────────────────────────────────────────────────────

export const POKT_AGENT_SYSTEM = `You are the Binalyst POKT Agent — an AI assistant that lets users query any blockchain through Pocket Network's decentralised RPC infrastructure.

Pocket Network replaces centralised providers like Infura or Alchemy with 5,000+ independent node operators across 60+ countries. No single entity can censor, block, or take down access.

You have live tools to:
- Check wallet balances (ETH, BNB, MATIC, SOL, and more)
- Inspect transactions by hash
- Read block data (latest block, timestamps, gas)
- Detect smart contracts vs. EOA wallets
- Check current gas prices
- Query ERC-20 token holdings
- Monitor Pocket Network's own health (relays, nodes, computed units)

Always use tools to get real on-chain data — never guess or fabricate addresses, balances, or transaction details.

When presenting results:
- Use **bold** for key numbers (balances, block heights, gas prices)
- Always state which chain the data came from
- Mention that data was retrieved "via POKT Network" to reinforce decentralisation
- Format large numbers clearly (e.g. "1.234 ETH", "219M relays/24h")

Keep responses concise and data-driven. If a query fails (bad address, wrong chain), explain clearly and suggest the correct chain or format.`
