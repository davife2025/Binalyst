// tests/zk-smoke-test.ts
//
// End-to-end smoke test for the Binalyst ZK pipeline.
// Runs entirely in mock mode (ZK_PROVER_MODE=mock, STELLAR_MOCK=true).
// No Rust build or Stellar wallet required.
//
// Usage:
//   ZK_PROVER_MODE=mock STELLAR_MOCK=true npx ts-node tests/zk-smoke-test.ts
//   # or via npm script:
//   npm run test:zk
//
// What it tests:
//   1. POST /api/zk/prove   — valid trade decision → success response
//   2. POST /api/zk/prove   — guardrail violation → 422 invalid proof
//   3. POST /api/zk/verify  — valid proof → Stellar mock tx
//   4. GET  /api/zk/verify  — health check → proof count
//   5. Full pipeline        — prove → verify chained together

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_REQUEST = {
  signal: {
    symbol:       'BTC',
    price:        65000,
    change24h:    2.5,
    fearGreed:    35,
    signalScore:  72,
    tags:         ['near_support'],
    technicals: {
      rsi14:     28.5,
      macdHist:  120,
      macdCross: 'BULLISH',
      bbPct:     0.15,
      bbWidth:   0.04,
      adx:       38,
      stochK:    25,
      obvTrend:  'UP',
      emaCross:  'BULLISH',
      techScore: 76,
      regime:    'TRENDING_UP',
    },
  },
  rule: {
    id:       'rule-001',
    name:     'RSI oversold + MACD bullish',
    symbol:   'BTC',
    action:   'BUY',
    sizePct:  10,
    priority: 1,
    condition: {
      type:  'and',
      left:  { type: 'rsi_below', value: 30 },
      right: { type: 'macd_cross', direction: 'BULLISH' },
    },
  },
  decision: {
    symbol:      'BTC',
    action:      'BUY',
    amountUSDT:  1000,
    signalScore: 72,
    reasoning:   'RSI oversold + MACD bullish cross',
    ruleId:      'rule-001',
    ruleName:    'RSI oversold + MACD bullish',
    guardrail:   'passed',
  },
  portfolioUSD: 10000,
  peakUSD:      10500,
  startUSD:     10000,
  tradesToday:  2,
  totalTrades:  5,
  config: {
    maxDrawdownPct:  30,
    maxPerTradePct:  15,
    maxDailyTrades:  8,
    dryRun:          true,
  },
}

const GUARDRAIL_VIOLATION_REQUEST = {
  ...VALID_REQUEST,
  portfolioUSD: 5000,
  peakUSD:      10000,   // 50% drawdown → exceeds 30% limit
}

const OVERSIZED_TRADE_REQUEST = {
  ...VALID_REQUEST,
  decision: {
    ...VALID_REQUEST.decision,
    amountUSDT: 3000,  // 30% of 10k → exceeds 15% per-trade limit
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function post(path: string, body: object): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`)
  return { status: res.status, data: await res.json() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('🧪 Binalyst ZK smoke test (mock mode)')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log('   ZK_PROVER_MODE=mock · STELLAR_MOCK=true')
  console.log('──────────────────────────────────────────')

  // ── 1. Health check ───────────────────────────────────────────────────────
  console.log('\nGET /api/zk/verify')
  await test('health check returns 200', async () => {
    const { status, data } = await get('/api/zk/verify')
    assert(status === 200, `Expected 200, got ${status}`)
    assert(typeof data.proofCount === 'number', 'proofCount missing')
    assert(data.mock === true || data.network !== undefined, 'network info missing')
  })

  // ── 2. Valid proof ────────────────────────────────────────────────────────
  console.log('\nPOST /api/zk/prove — valid trade')
  let validSealHex  = ''
  let validJournalHex = ''
  let validProofId  = ''

  await test('returns success=true', async () => {
    const { status, data } = await post('/api/zk/prove', VALID_REQUEST)
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
    assert(data.success === true, `success should be true: ${data.error}`)
    validSealHex    = data.sealHex
    validJournalHex = data.journalHex
    validProofId    = data.proofId
  })

  await test('output.valid is true', async () => {
    const { data } = await post('/api/zk/prove', VALID_REQUEST)
    assert(data.output?.valid === true, `output.valid should be true, got: ${JSON.stringify(data.output)}`)
  })

  await test('output has all guardrail fields', async () => {
    const { data } = await post('/api/zk/prove', VALID_REQUEST)
    const o = data.output
    assert(typeof o.drawdown_pct     === 'number',  'drawdown_pct missing')
    assert(typeof o.trade_size_pct   === 'number',  'trade_size_pct missing')
    assert(typeof o.condition_fired  === 'boolean', 'condition_fired missing')
    assert(typeof o.daily_trades_ok  === 'boolean', 'daily_trades_ok missing')
    assert(typeof o.attestation      === 'string',  'attestation missing')
    assert(o.drawdown_ok   === true, `drawdown_ok should be true, drawdown=${o.drawdown_pct}%`)
    assert(o.trade_size_ok === true, `trade_size_ok should be true, size=${o.trade_size_pct}%`)
  })

  await test('returns sealHex and journalHex', async () => {
    const { data } = await post('/api/zk/prove', VALID_REQUEST)
    assert(typeof data.sealHex    === 'string' && data.sealHex.length > 0,    'sealHex empty')
    assert(typeof data.journalHex === 'string' && data.journalHex.length > 0, 'journalHex empty')
    assert(typeof data.proofId    === 'string' && data.proofId.length > 0,    'proofId empty')
    assert(typeof data.elapsedMs  === 'number',                               'elapsedMs missing')
  })

  // ── 3. Guardrail violations ───────────────────────────────────────────────
  console.log('\nPOST /api/zk/prove — guardrail violations')

  await test('drawdown violation → success=false, valid=false', async () => {
    const { status, data } = await post('/api/zk/prove', GUARDRAIL_VIOLATION_REQUEST)
    assert(status === 422, `Expected 422, got ${status}`)
    assert(data.success === false, 'success should be false for drawdown violation')
    assert(data.output?.valid === false, 'output.valid should be false')
    assert(data.output?.drawdown_ok === false, 'drawdown_ok should be false')
  })

  await test('oversized trade → success=false, trade_size_ok=false', async () => {
    const { status, data } = await post('/api/zk/prove', OVERSIZED_TRADE_REQUEST)
    assert(status === 422, `Expected 422, got ${status}`)
    assert(data.output?.trade_size_ok === false, 'trade_size_ok should be false for 30% trade')
  })

  // ── 4. Verify (Stellar mock) ──────────────────────────────────────────────
  console.log('\nPOST /api/zk/verify — Stellar mock')

  await test('returns success=true with mock tx', async () => {
    const body = { proofId: validProofId, sealHex: validSealHex, journalHex: validJournalHex }
    const { status, data } = await post('/api/zk/verify', body)
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
    assert(data.success === true, `success should be true: ${data.error}`)
    assert(typeof data.stellarTxId === 'string' && data.stellarTxId.length > 0, 'stellarTxId missing')
    assert(typeof data.proofIndex  === 'number',  'proofIndex missing')
    assert(typeof data.explorerUrl === 'string',  'explorerUrl missing')
  })

  await test('missing fields returns 400', async () => {
    const { status } = await post('/api/zk/verify', { proofId: 'test' })
    assert(status === 400, `Expected 400 for missing fields, got ${status}`)
  })

  // ── 5. Full pipeline ──────────────────────────────────────────────────────
  console.log('\nFull pipeline: prove → verify')

  await test('prove then verify completes end-to-end', async () => {
    const proveRes = await post('/api/zk/prove', VALID_REQUEST)
    assert(proveRes.data.success === true, `prove failed: ${proveRes.data.error}`)

    const verifyRes = await post('/api/zk/verify', {
      proofId:    proveRes.data.proofId,
      sealHex:    proveRes.data.sealHex,
      journalHex: proveRes.data.journalHex,
    })
    assert(verifyRes.data.success === true, `verify failed: ${verifyRes.data.error}`)
    assert(typeof verifyRes.data.stellarTxId === 'string', 'no Stellar tx in pipeline test')
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('')
  console.log('──────────────────────────────────────────')
  console.log(`Results: ${passed} passed · ${failed} failed`)
  console.log('')
  if (failed === 0) {
    console.log('✅ All ZK smoke tests passed — pipeline is working in mock mode')
    console.log('   Next: bash scripts/verify-setup.sh before switching to real mode')
  } else {
    console.log('✗  Some tests failed — check the errors above')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Smoke test crashed:', err.message)
  process.exit(1)
})
