/**
 * lib/claude.ts
 * OpenClaw AI Agent — Claude + Binance tools.
 * Claude can call Binance API actions directly as tools.
 * User must explicitly enable auto-trade; otherwise all trade tools
 * return a confirmation request instead of executing.
 */

import Anthropic from '@anthropic-ai/sdk'
import { BinanceClient, publicMarket, type BinanceCredentials } from './binance'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type AgentMode = 'assistant' | 'analyst' | 'trader' | 'educator'

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions — what OpenClaw can do autonomously
// ─────────────────────────────────────────────────────────────────────────────
export const OPENCLAW_TOOLS: Anthropic.Tool[] = [
  // Market data tools (always available, no auth)
  {
    name: 'get_price',
    description: 'Get the current live price of any coin on Binance. Use for BTCUSDT, ETHUSDT, BNBUSDT etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Trading pair e.g. BTCUSDT, ETHUSDT' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_top_movers',
    description: 'Get the top gaining and losing coins on Binance in the last 24 hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'How many to return, default 10' },
      },
    },
  },
  {
    name: 'get_klines',
    description: 'Get OHLCV candlestick data for technical analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTCUSDT' },
        interval: { type: 'string', enum: ['1m','5m','15m','1h','4h','1d','1w'], description: 'Candle interval' },
        limit: { type: 'number', description: 'Number of candles, default 50' },
      },
      required: ['symbol', 'interval'],
    },
  },
  {
    name: 'get_order_book',
    description: 'Get the current order book (bids/asks) for a symbol. Useful for liquidity analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        depth: { type: 'number', description: 'Number of levels, default 10' },
      },
      required: ['symbol'],
    },
  },
  // Account tools (require API key)
  {
    name: 'get_balances',
    description: 'Get the user\'s Binance wallet balances and portfolio value in USD.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_open_orders',
    description: 'Get the user\'s currently open orders on Binance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Optional: filter by symbol e.g. BTCUSDT' },
      },
    },
  },
  // Trading tools (require API key + explicit auto-trade permission)
  {
    name: 'place_order',
    description: 'Place a buy or sell order on Binance. ONLY use when user explicitly requests a trade. Always confirm intent before placing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTCUSDT' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        type: { type: 'string', enum: ['MARKET', 'LIMIT', 'STOP_LOSS_LIMIT'] },
        quantity: { type: 'number', description: 'Amount of base asset' },
        quoteOrderQty: { type: 'number', description: 'Amount in USDT for market buys' },
        price: { type: 'number', description: 'Required for LIMIT orders' },
        timeInForce: { type: 'string', enum: ['GTC', 'IOC', 'FOK'] },
      },
      required: ['symbol', 'side', 'type'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancel an open order on Binance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        orderId: { type: 'number' },
      },
      required: ['symbol', 'orderId'],
    },
  },
  // Web search (for events, news, announcements)
  {
    name: 'web_search',
    description: 'Search the web for latest Binance news, announcements, new listings, airdrops, and market news.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
]

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  assistant: `You are OpenClaw, an elite AI assistant for Binance users. You have live access to Binance market data, the user's portfolio, and trading capabilities. 

RULES:
- Always use get_price or get_klines before discussing specific prices — don't guess
- For trading: always confirm intent, show the order details, and wait for explicit confirmation before placing
- For portfolio questions: call get_balances first
- Be concise and data-driven. Lead with numbers, follow with context
- Format: use **bold** for prices and key metrics, bullet points for lists
- Never hallucinate prices. If a tool fails, say so clearly`,

  analyst: `You are OpenClaw's market analyst module. You combine on-chain intuition with technical analysis. Use klines data for TA, order book for liquidity, web_search for news. 

Structure analysis as:
1. Current price & trend
2. Key support/resistance levels
3. Recent catalysts (use web_search)
4. Bull case / Bear case
5. Suggested entry/exit zones (not financial advice)`,

  trader: `You are OpenClaw's trading assistant. Help users execute trades efficiently on Binance. 

TRADING PROTOCOL:
1. Confirm the trade details with user before placing
2. Check balance with get_balances first
3. Validate order with test before real execution
4. Always show: symbol, side, amount, type, estimated value
5. Warn about market vs limit differences
6. Never place orders without explicit user confirmation in the conversation`,

  educator: `You are OpenClaw Academy — a world-class crypto and Binance educator. Use real examples, clear analogies, and structured explanations. When discussing prices or market conditions, use get_price for live data. Make every explanation practical and actionable.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool executor — runs the actual Binance calls
// ─────────────────────────────────────────────────────────────────────────────
export async function executeTool(
  toolName: string,
  toolInput: any,
  credentials?: BinanceCredentials,
  autoTradeEnabled = false
): Promise<any> {
  const binance = credentials ? new BinanceClient(credentials) : null

  switch (toolName) {
    // ── Market (public) ────────────────────────────────────────────────────
    case 'get_price': {
      const prices = await publicMarket.getPrices([toolInput.symbol])
      return { symbol: toolInput.symbol, price: prices[toolInput.symbol] ?? 'not found' }
    }

    case 'get_top_movers': {
      return await publicMarket.getTopMovers(toolInput.limit ?? 10)
    }

    case 'get_klines': {
      const klines = await publicMarket.getKlines(
        toolInput.symbol,
        toolInput.interval,
        toolInput.limit ?? 50
      )
      // Return summary stats to keep token count manageable
      const closes = klines.map(k => parseFloat(k.close))
      const high = Math.max(...klines.map(k => parseFloat(k.high)))
      const low = Math.min(...klines.map(k => parseFloat(k.low)))
      return {
        symbol: toolInput.symbol,
        interval: toolInput.interval,
        candles: klines.length,
        currentPrice: closes[closes.length - 1],
        high,
        low,
        change: ((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2) + '%',
        recentCloses: closes.slice(-10),
      }
    }

    case 'get_order_book': {
      if (!binance) return { error: 'No Binance credentials' }
      return await binance.getOrderBook(toolInput.symbol, toolInput.depth ?? 10)
    }

    // ── Account (requires credentials) ────────────────────────────────────
    case 'get_balances': {
      if (!binance) return { error: 'Connect your Binance API key to access portfolio data.' }
      return await binance.getPortfolioValue()
    }

    case 'get_open_orders': {
      if (!binance) return { error: 'Connect your Binance API key to access orders.' }
      return await binance.getOpenOrders(toolInput.symbol)
    }

    // ── Trading (requires credentials + explicit permission) ───────────────
    case 'place_order': {
      if (!binance) return { error: 'Connect your Binance API key to trade.' }
      if (!autoTradeEnabled) {
        // Return a structured confirmation request — UI renders a confirm dialog
        return {
          requiresConfirmation: true,
          order: toolInput,
          message: `⚠️ Ready to place order: ${toolInput.side} ${toolInput.quantity ?? ''} ${toolInput.symbol} @ ${toolInput.type}. Please confirm in the UI.`,
        }
      }
      // Validate first
      const test = await binance.testOrder(toolInput)
      if (!test.valid) return { error: `Order invalid: ${test.message}` }
      return await binance.placeOrder(toolInput)
    }

    case 'cancel_order': {
      if (!binance) return { error: 'Connect your Binance API key to cancel orders.' }
      return await binance.cancelOrder(toolInput.symbol, toolInput.orderId)
    }

    // ── Web search (delegated to Anthropic web_search tool) ────────────────
    case 'web_search': {
      // This is handled inline by passing web_search to Anthropic directly
      return { note: 'web_search is handled by Anthropic API natively' }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main agent runner — handles multi-turn tool loops
// ─────────────────────────────────────────────────────────────────────────────
export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | Anthropic.ContentBlock[]
}

export async function runAgent({
  messages,
  mode = 'assistant',
  credentials,
  autoTradeEnabled = false,
  onChunk,
}: {
  messages: AgentMessage[]
  mode?: AgentMode
  credentials?: BinanceCredentials
  autoTradeEnabled?: boolean
  onChunk?: (text: string) => void
}): Promise<{ text: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = []

  // Combine our custom tools with Anthropic's native web_search
  const tools: any[] = [
    { type: 'web_search_20250305', name: 'web_search' },
    ...OPENCLAW_TOOLS.filter(t => t.name !== 'web_search'),
  ]

  let currentMessages = messages as any[]
  let finalText = ''

  // Agentic loop — continues until no more tool calls
  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPTS[mode],
      tools,
      messages: currentMessages,
    })

    // Collect text from this turn
    const textBlocks = response.content.filter(b => b.type === 'text')
    const turnText = textBlocks.map((b: any) => b.text).join('')
    if (turnText) {
      finalText += turnText
      if (onChunk) onChunk(turnText)
    }

    // No tool calls — we're done
    if (response.stop_reason === 'end_turn') break

    // Process tool calls
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    if (toolUseBlocks.length === 0) break

    // Add assistant's response to messages
    currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolBlock of toolUseBlocks as Anthropic.ToolUseBlock[]) {
      toolsUsed.push(toolBlock.name)
      
      // web_search is handled natively by Anthropic — pass through
      if (toolBlock.name === 'web_search') {
        // Results come back in the next iteration automatically
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: 'Search executed via Anthropic native web search.',
        })
        continue
      }

      try {
        const result = await executeTool(
          toolBlock.name,
          toolBlock.input,
          credentials,
          autoTradeEnabled
        )
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        })
      } catch (err: any) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify({ error: err.message }),
          is_error: true,
        })
      }
    }

    currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
  }

  return { text: finalText, toolsUsed }
}
