/**
 * lib/claude.ts — Binalyst AI Agent
 * Using Google Gemini Flash (free tier) — 1,500 requests/day, no credit card needed.
 * All Binance + Web3 skills tools preserved.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { BinanceClient, publicMarket, type BinanceCredentials } from './binance'
import {
  getMarketRankings, getTokenInfo, searchToken,
  getTokenAudit, getAddressInfo, getAddressTokenHoldings,
  getMemeRush, getAlphaTokens,
} from './skills/web3'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export type AgentMode = 'assistant' | 'analyst' | 'trader' | 'educator'

const TOOL_DECLARATIONS = [
  { name: 'get_price',         description: 'Get the current live price of any coin on Binance.', parameters: { type: 'OBJECT', properties: { symbol: { type: 'STRING', description: 'e.g. BTCUSDT' } }, required: ['symbol'] } },
  { name: 'get_top_movers',    description: 'Get top gaining and losing coins on Binance in the last 24 hours.', parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER' } } } },
  { name: 'get_klines',        description: 'Get candlestick data for technical analysis.', parameters: { type: 'OBJECT', properties: { symbol: { type: 'STRING' }, interval: { type: 'STRING', description: '1m,5m,15m,1h,4h,1d' }, limit: { type: 'NUMBER' } }, required: ['symbol','interval'] } },
  { name: 'get_balances',      description: "Get the user's Binance wallet balances and portfolio value.", parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_open_orders',   description: "Get the user's open orders on Binance.", parameters: { type: 'OBJECT', properties: { symbol: { type: 'STRING' } } } },
  { name: 'skill_market_rank', description: 'Get crypto market rankings: trending, smart money, social hype, memes, top traders.', parameters: { type: 'OBJECT', properties: { rankType: { type: 'STRING', description: 'trending|smart_money|social_hype|meme|alpha|traders' }, chainId: { type: 'STRING', description: '1=ETH,56=BSC,CT_501=SOL' }, size: { type: 'NUMBER' } } } },
  { name: 'skill_token_info',  description: 'Look up on-chain token info: price, liquidity, market cap, holders.', parameters: { type: 'OBJECT', properties: { address: { type: 'STRING' }, keyword: { type: 'STRING' }, chainId: { type: 'STRING' } } } },
  { name: 'skill_token_audit', description: 'Security audit a token contract: rug pull, honeypot, ownership, liquidity lock.', parameters: { type: 'OBJECT', properties: { address: { type: 'STRING' }, chainId: { type: 'STRING' } }, required: ['address'] } },
  { name: 'skill_address_info',description: 'Analyze a wallet: token holdings, portfolio value, PnL, whale detection.', parameters: { type: 'OBJECT', properties: { address: { type: 'STRING' }, chainId: { type: 'STRING' } }, required: ['address'] } },
  { name: 'skill_meme_rush',   description: 'Discover trending meme tokens on Binance Web3 Pulse.', parameters: { type: 'OBJECT', properties: { sortBy: { type: 'STRING', description: 'created|trending|volume' }, chainId: { type: 'STRING' }, size: { type: 'NUMBER' } } } },
  { name: 'skill_alpha',       description: 'Get Binance Alpha token listings and opportunities.', parameters: { type: 'OBJECT', properties: {} } },
]

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  assistant: `You are Binalyst, an elite AI assistant for Binance users. You have live access to Binance market data and Binance Skills Hub integrations. Use tools to get real data — never guess prices. Be concise and data-driven. Use **bold** for prices and key metrics.`,
  analyst:   `You are Binalyst's market analyst. Use skill_market_rank for trends, skill_token_info for fundamentals, skill_token_audit for risk. Structure: price → trend → on-chain signals → bull/bear cases.`,
  trader:    `You are Binalyst's trading assistant. Always validate before placing orders. Use skill_token_audit to check contract safety before recommending any token.`,
  educator:  `You are Binalyst Academy — a crypto educator. Use real examples, clear analogies, and get_price for live data when discussing prices. Teach Binance products and trading practically.`,
}

async function executeTool(name: string, args: any, credentials?: BinanceCredentials): Promise<any> {
  const binance = credentials ? new BinanceClient(credentials) : null
  switch (name) {
    case 'get_price': {
      const prices = await publicMarket.getPrices([args.symbol])
      return { symbol: args.symbol, price: prices[args.symbol] ?? 'not found' }
    }
    case 'get_top_movers':  return await publicMarket.getTopMovers(args.limit ?? 10)
    case 'get_klines': {
      const klines = await publicMarket.getKlines(args.symbol, args.interval, args.limit ?? 50)
      const closes = klines.map(k => parseFloat(k.close))
      return { symbol: args.symbol, currentPrice: closes[closes.length-1], high: Math.max(...klines.map(k=>parseFloat(k.high))), low: Math.min(...klines.map(k=>parseFloat(k.low))), change: ((closes[closes.length-1]-closes[0])/closes[0]*100).toFixed(2)+'%', recentCloses: closes.slice(-10) }
    }
    case 'get_balances':     return binance ? await binance.getPortfolioValue() : { error: 'Connect your Binance API key.' }
    case 'get_open_orders':  return binance ? await binance.getOpenOrders(args.symbol) : { error: 'Connect your Binance API key.' }
    case 'skill_market_rank': return await getMarketRankings({ rankType: args.rankType, chainId: args.chainId ?? '56', size: args.size ?? 20 })
    case 'skill_token_info':  return args.keyword ? await searchToken({ keyword: args.keyword, chainId: args.chainId ?? '56' }) : await getTokenInfo({ address: args.address, chainId: args.chainId ?? '56' })
    case 'skill_token_audit': return await getTokenAudit({ address: args.address, chainId: args.chainId ?? '56' })
    case 'skill_address_info': {
      const [info, holdings] = await Promise.allSettled([
        getAddressInfo({ address: args.address, chainId: args.chainId ?? '56' }),
        getAddressTokenHoldings({ address: args.address, chainId: args.chainId ?? '56' }),
      ])
      return { info: info.status==='fulfilled'?info.value:null, holdings: holdings.status==='fulfilled'?holdings.value:[] }
    }
    case 'skill_meme_rush': return await getMemeRush({ chainId: args.chainId ?? '56', sortBy: args.sortBy ?? 'trending', size: args.size ?? 20 })
    case 'skill_alpha':     return await getAlphaTokens()
    default:                return { error: `Unknown tool: ${name}` }
  }
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'model'
  content: string
}

export async function runAgent({
  messages, mode = 'assistant', credentials, onChunk,
}: {
  messages:     AgentMessage[]
  mode?:        AgentMode
  credentials?: BinanceCredentials
  autoTradeEnabled?: boolean
  onChunk?:     (text: string) => void
}): Promise<{ text: string; toolsUsed: string[] }> {

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPTS[mode],
    tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
  })

  // Build history (all but last message)
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }))

  const lastMsg = messages[messages.length - 1]
  const chat    = model.startChat({ history })
  const toolsUsed: string[] = []
  let finalText = ''

  // Turn 1 — initial response + possible tool calls
  const result1 = await chat.sendMessage(
    typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content)
  )

  const calls = result1.response.functionCalls()

  if (!calls || calls.length === 0) {
    // No tools needed — return text directly
    finalText = result1.response.text()
    if (onChunk && finalText) onChunk(finalText)
    return { text: finalText, toolsUsed }
  }

  // Execute tool calls
  const funcResponses: any[] = []
  for (const call of calls) {
    toolsUsed.push(call.name)
    try {
      const res = await executeTool(call.name, call.args, credentials)
      funcResponses.push({ functionResponse: { name: call.name, response: { result: JSON.stringify(res) } } })
    } catch (err: any) {
      funcResponses.push({ functionResponse: { name: call.name, response: { error: err.message } } })
    }
  }

  // Turn 2 — final response with tool results
  const result2 = await chat.sendMessage(funcResponses)
  finalText = result2.response.text()
  if (onChunk && finalText) onChunk(finalText)

  return { text: finalText, toolsUsed }
}
