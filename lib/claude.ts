import Anthropic from '@anthropic-ai/sdk'
import { BinanceClient, publicMarket, type BinanceCredentials } from './binance'
import {
  queryTokenInfo, queryTokenAudit,
  queryAddressInfo, queryAddressTokens,
  queryMarketRank, queryMemeRush,
  queryAlphaTokens, postToSquare,
  chainNameToId,
} from './skills'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export type AgentMode = 'assistant' | 'analyst' | 'trader' | 'educator'

export const OPENCLAW_TOOLS: Anthropic.Tool[] = [
  { name: 'get_price', description: 'Get current live price of any Binance spot pair e.g. BTCUSDT',
    input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
  { name: 'get_top_movers', description: 'Get top gaining/losing coins on Binance in last 24h',
    input_schema: { type: 'object' as const, properties: { limit: { type: 'number' } } } },
  { name: 'get_klines', description: 'Get OHLCV candlestick data for TA',
    input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' }, interval: { type: 'string', enum: ['1m','5m','15m','1h','4h','1d','1w'] }, limit: { type: 'number' } }, required: ['symbol','interval'] } },
  { name: 'get_balances', description: "Get user's Binance wallet balances and portfolio value in USD",
    input_schema: { type: 'object' as const, properties: {} } },
  { name: 'get_open_orders', description: "Get user's open orders on Binance",
    input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' } } } },
  { name: 'place_order', description: 'Place a buy/sell order on Binance. ALWAYS confirm with user first.',
    input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['BUY','SELL'] }, type: { type: 'string', enum: ['MARKET','LIMIT','STOP_LOSS_LIMIT'] }, quantity: { type: 'number' }, quoteOrderQty: { type: 'number' }, price: { type: 'number' }, timeInForce: { type: 'string', enum: ['GTC','IOC','FOK'] } }, required: ['symbol','side','type'] } },
  // ── Skills Hub ──────────────────────────────────────────────────────────────
  { name: 'skill_token_search',
    description: 'Search any Web3 token by name/symbol/contract on Binance Web3. Returns price, liquidity, holders, volume, social links.',
    input_schema: { type: 'object' as const, properties: { keyword: { type: 'string' }, chain: { type: 'string', description: 'bsc, eth, base, solana' } }, required: ['keyword'] } },
  { name: 'skill_token_audit',
    description: 'Security audit a token contract — detects honeypots, rug risks, blacklists, minting risks. ALWAYS run on unknown tokens.',
    input_schema: { type: 'object' as const, properties: { contract: { type: 'string' }, chain: { type: 'string' } }, required: ['contract'] } },
  { name: 'skill_address_info',
    description: 'Analyze any wallet — token holdings, positions, P&L. Use for whale/smart money tracking.',
    input_schema: { type: 'object' as const, properties: { address: { type: 'string' }, chain: { type: 'string' } }, required: ['address'] } },
  { name: 'skill_market_rank',
    description: 'Get market rankings: trending, top-searched, alpha, smart-money, meme, social hype.',
    input_schema: { type: 'object' as const, properties: { type: { type: 'string', enum: ['trending','top-searched','alpha','smart-money','meme','social'] } } } },
  { name: 'skill_meme_rush',
    description: 'Real-time meme token lists from launchpads (Pump.fun, Four.meme). New, finalizing, migrated.',
    input_schema: { type: 'object' as const, properties: { stage: { type: 'string', enum: ['new','finalizing','migrated'] }, chain: { type: 'string' } } } },
  { name: 'skill_alpha_tokens',
    description: 'Get current Binance Alpha tokens and airdrop opportunities.',
    input_schema: { type: 'object' as const, properties: {} } },
  { name: 'skill_square_post',
    description: 'Post to Binance Square social platform. Confirm content with user first.',
    input_schema: { type: 'object' as const, properties: { content: { type: 'string' } }, required: ['content'] } },
]

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  assistant: `You are Binalyst, an elite AI assistant for Binance users with live CEX + Web3 data access.

TOOL RULES:
- Any token question → skill_token_search first
- Unknown token / "is this safe?" → ALWAYS run skill_token_audit
- Wallet/address questions → skill_address_info  
- "What's trending/hot?" → skill_market_rank
- New meme coins → skill_meme_rush
- Alpha airdrops → skill_alpha_tokens
- CEX prices/charts → get_price / get_klines
- Before Square post → confirm with user first

Be concise, data-driven. **bold** for key numbers.`,

  analyst: `You are Binalyst's analyst. Combine CEX data + on-chain Web3 intelligence.
For token analysis: 1) search info 2) audit if unknown 3) check market rank 4) get klines for TA.
Structure: Price → On-chain metrics → Risk → Bull/Bear case.`,

  trader: `You are Binalyst's trading assistant. Protocol: 1) Confirm intent 2) Audit unknown tokens 3) Check balance 4) Validate order 5) Confirm dialog. Never execute without explicit confirmation.`,

  educator: `You are Binalyst Academy. Explain crypto, DeFi, Web3, and Binance clearly with examples. Use live skill data to illustrate real examples when helpful.`,
}

export async function executeTool(toolName: string, toolInput: any, credentials?: BinanceCredentials, autoTradeEnabled = false): Promise<any> {
  const binance = credentials ? new BinanceClient(credentials) : null

  switch (toolName) {
    case 'get_price': {
      const prices = await publicMarket.getPrices([toolInput.symbol])
      return { symbol: toolInput.symbol, price: prices[toolInput.symbol] ?? 'not found' }
    }
    case 'get_top_movers': return await publicMarket.getTopMovers(toolInput.limit ?? 10)
    case 'get_klines': {
      const klines = await publicMarket.getKlines(toolInput.symbol, toolInput.interval, toolInput.limit ?? 50)
      const closes = klines.map(k => parseFloat(k.close))
      return { symbol: toolInput.symbol, interval: toolInput.interval, candles: klines.length, currentPrice: closes[closes.length-1], high: Math.max(...klines.map(k=>parseFloat(k.high))), low: Math.min(...klines.map(k=>parseFloat(k.low))), change: ((closes[closes.length-1]-closes[0])/closes[0]*100).toFixed(2)+'%', recentCloses: closes.slice(-10) }
    }
    case 'get_balances':
      if (!binance) return { error: 'Connect your Binance API key to access portfolio.' }
      return await binance.getPortfolioValue()
    case 'get_open_orders':
      if (!binance) return { error: 'Connect your Binance API key to access orders.' }
      return await binance.getOpenOrders(toolInput.symbol)
    case 'place_order': {
      if (!binance) return { error: 'Connect your Binance API key to trade.' }
      if (!autoTradeEnabled) return { requiresConfirmation: true, order: toolInput, message: `⚠️ Ready to place: ${toolInput.side} ${toolInput.quantity??''} ${toolInput.symbol} @ ${toolInput.type}. Please confirm.` }
      const test = await binance.testOrder(toolInput)
      if (!test.valid) return { error: `Order invalid: ${test.message}` }
      return await binance.placeOrder(toolInput)
    }
    case 'skill_token_search': {
      const chainIds = toolInput.chain ? chainNameToId(toolInput.chain) : '56,1,8453,CT_501'
      return await queryTokenInfo(toolInput.keyword, chainIds)
    }
    case 'skill_token_audit': {
      const chainId = toolInput.chain ? chainNameToId(toolInput.chain) : '56'
      return await queryTokenAudit(toolInput.contract, chainId)
    }
    case 'skill_address_info': {
      const chainId = toolInput.chain ? chainNameToId(toolInput.chain) : '56'
      const [positions, tokens] = await Promise.allSettled([
        queryAddressInfo(toolInput.address, chainId),
        queryAddressTokens(toolInput.address, chainId),
      ])
      return { positions: positions.status==='fulfilled'?positions.value:null, tokens: tokens.status==='fulfilled'?tokens.value:null }
    }
    case 'skill_market_rank': return await queryMarketRank(toolInput.type ?? 'trending')
    case 'skill_meme_rush': {
      const chainId = toolInput.chain ? chainNameToId(toolInput.chain) : '56'
      return await queryMemeRush(toolInput.stage ?? 'new', chainId)
    }
    case 'skill_alpha_tokens': return await queryAlphaTokens()
    case 'skill_square_post':
      if (!credentials) return { error: 'Connect your Binance API key to post to Square.' }
      return await postToSquare(toolInput.content, credentials.apiKey, credentials.apiSecret)
    default: return { error: `Unknown tool: ${toolName}` }
  }
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | Anthropic.ContentBlock[]
}

export async function runAgent({ messages, mode = 'assistant', credentials, autoTradeEnabled = false, onChunk }: {
  messages: AgentMessage[]; mode?: AgentMode; credentials?: BinanceCredentials; autoTradeEnabled?: boolean; onChunk?: (text: string) => void
}): Promise<{ text: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = []
  const tools: any[] = [{ type: 'web_search_20250305', name: 'web_search' }, ...OPENCLAW_TOOLS]
  let currentMessages = messages as any[]
  let finalText = ''

  for (let i = 0; i < 12; i++) {
    const response = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, system: SYSTEM_PROMPTS[mode], tools, messages: currentMessages })
    const turnText = response.content.filter(b=>b.type==='text').map((b:any)=>b.text).join('')
    if (turnText) { finalText += turnText; if (onChunk) onChunk(turnText) }
    if (response.stop_reason === 'end_turn') break
    const toolUseBlocks = response.content.filter(b=>b.type==='tool_use')
    if (!toolUseBlocks.length) break
    currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tb of toolUseBlocks as Anthropic.ToolUseBlock[]) {
      toolsUsed.push(tb.name)
      if (tb.name === 'web_search') { toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: 'Search executed.' }); continue }
      try {
        const result = await executeTool(tb.name, tb.input, credentials, autoTradeEnabled)
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: JSON.stringify(result) })
      } catch (err: any) {
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: JSON.stringify({ error: err.message }), is_error: true })
      }
    }
    currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
  }
  return { text: finalText, toolsUsed }
}
