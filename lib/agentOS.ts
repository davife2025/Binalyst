/**
 * lib/agentOS.ts
 *
 * Minimal client for Binance's official Agent OS MCP server
 * (https://developers.binance.com/en/docs/agent-native/mcp-server/agentic).
 *
 * Endpoint: https://agent.binance.com/mcp/agentic
 * Transport: MCP "Streamable HTTP" — JSON-RPC 2.0 over POST, response is
 * either a single JSON object or a short SSE stream (`data: {...}` lines).
 *
 * Scope used here: **market data only** — public, no OAuth/API key required.
 * Account/trade/transfer scopes need the browser OAuth flow described in
 * Binance's docs and are intentionally NOT implemented here; this module
 * exists to prove Binalyst talks to the real Agent OS endpoint, not to
 * replace the existing direct Binance REST integration in lib/binance.ts.
 */

const AGENT_OS_ENDPOINT = 'https://agent.binance.com/mcp/agentic'
const REQUEST_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 15_000

interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: { code: number; message: string }
}

interface McpTool {
  name: string
  description?: string
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] }
}

export interface AgentOSSnapshot {
  connected: boolean
  endpoint: string
  serverInfo?: { name?: string; version?: string }
  toolCount?: number
  toolNames?: string[]
  ticker?: { symbol: string; price?: string; changePct?: string; tool: string }
  error?: string
  checkedAt: number
}

let cache: AgentOSSnapshot | null = null
let cacheAt = 0

async function rpc(
  sessionId: string | null,
  body: Record<string, unknown>,
): Promise<{ sessionId: string | null; data: JsonRpcResponse | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(AGENT_OS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const newSessionId = res.headers.get('mcp-session-id') ?? sessionId
    const raw = await res.text()
    return { sessionId: newSessionId, data: parseMcpBody(raw) }
  } finally {
    clearTimeout(timer)
  }
}

/** Parses either a plain JSON body or an SSE stream ("data: {...}\n\n"), returning the last JSON-RPC message. */
function parseMcpBody(raw: string): JsonRpcResponse | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    // Fall through to SSE parsing
  }

  const lines = trimmed.split('\n').filter(l => l.startsWith('data:'))
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i].slice(5).trim())
    } catch {
      continue
    }
  }
  return null
}

const TICKER_TOOL_HINTS = ['ticker', 'price', 'market_data', 'quote']
const SYMBOL_ARG_HINTS  = ['symbol', 'ticker', 'pair']

function pickTickerTool(tools: McpTool[]): McpTool | undefined {
  return tools.find(t => TICKER_TOOL_HINTS.some(h => t.name.toLowerCase().includes(h)))
}

function pickSymbolArgName(tool: McpTool): string {
  const props = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : []
  return props.find(p => SYMBOL_ARG_HINTS.some(h => p.toLowerCase().includes(h))) ?? 'symbol'
}

/**
 * Connects to the live Binance Agent OS MCP endpoint, lists its tools, and
 * (best-effort) pulls a BTCUSDT-style ticker via whichever market-data tool
 * it advertises. Read-only, no credentials. Cached for CACHE_TTL_MS.
 */
export async function getAgentOSSnapshot(symbol = 'BTCUSDT'): Promise<AgentOSSnapshot> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache

  const snapshot: AgentOSSnapshot = {
    connected: false,
    endpoint: AGENT_OS_ENDPOINT,
    checkedAt: Date.now(),
  }

  try {
    // 1. initialize
    const init = await rpc(null, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'binalyst', version: '1.0.0' },
      },
    })
    if (!init.data?.result) throw new Error(init.data?.error?.message ?? 'initialize failed')
    const sessionId = init.sessionId
    snapshot.serverInfo = init.data.result.serverInfo

    // 2. notifications/initialized (fire-and-forget per MCP spec)
    await rpc(sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' }).catch(() => {})

    // 3. tools/list
    const list = await rpc(sessionId, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const tools: McpTool[] = list.data?.result?.tools ?? []
    snapshot.toolCount = tools.length
    snapshot.toolNames = tools.map(t => t.name)
    snapshot.connected = true

    // 4. best-effort ticker call
    const tickerTool = pickTickerTool(tools)
    if (tickerTool) {
      const argName = pickSymbolArgName(tickerTool)
      const call = await rpc(sessionId, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: tickerTool.name, arguments: { [argName]: symbol } },
      })
      const content = call.data?.result?.content
      const text: string | undefined = Array.isArray(content)
        ? content.find((c: any) => c.type === 'text')?.text
        : undefined
      if (text) {
        try {
          const parsed = JSON.parse(text)
          snapshot.ticker = {
            symbol,
            price: parsed.price ?? parsed.lastPrice,
            changePct: parsed.priceChangePercent ?? parsed.changePct,
            tool: tickerTool.name,
          }
        } catch {
          snapshot.ticker = { symbol, tool: tickerTool.name }
        }
      }
    }
  } catch (err: any) {
    snapshot.connected = false
    snapshot.error = err?.message ?? 'agent os request failed'
  }

  cache = snapshot
  cacheAt = Date.now()
  return snapshot
}
