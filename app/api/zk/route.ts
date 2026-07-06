// app/api/zk/route.ts — REWRITTEN (Session P2)
//
// Consolidated prove + verify route (matches the single-route consolidation
// pattern from earlier, kept for projects that adopted it — but works fine
// as two separate routes too if you're on the original session R/S layout).
//
// Key change from prior sessions: binalyst-zk-host now outputs
//   { sealHex, imageIdHex, journalDigestHex, output, elapsedMs }
// instead of { sealHex, journalHex }. The Soroban call now passes
// (seal, journal_digest, journal_json) — image_id lives in the contract,
// set once at initialise() time, not passed per-proof.

import { NextRequest, NextResponse } from 'next/server'
import { spawn }                     from 'child_process'
import { randomUUID }                from 'crypto'
import { rateLimit }                 from '@/lib/rateLimit'
import { buildTradeProofInput }      from '@/lib/stellar/serialise'
import { getStellarClient, STELLAR_CONFIG } from '@/lib/stellar/client'
import type { TradeProofOutput } from '@/lib/stellar/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const ZK_HOST_BIN  = process.env.ZK_HOST_BIN    ?? './target/release/binalyst-zk-host'
const ZK_MODE      = process.env.ZK_PROVER_MODE ?? 'mock'
const STELLAR_MOCK = process.env.STELLAR_MOCK   === 'true'

let mockProofCounter = 0

export async function GET(): Promise<NextResponse> {
  try {
    if (STELLAR_MOCK) {
      return NextResponse.json({ mock: true, network: STELLAR_CONFIG.network,
        contractId: STELLAR_CONFIG.contractId, routerId: STELLAR_CONFIG.routerId,
        proofCount: 3, explorerUrl: STELLAR_CONFIG.explorerUrl })
    }
    const client     = getStellarClient()
    const proofCount = await client.proofCount()
    return NextResponse.json({ mock: false, network: STELLAR_CONFIG.network,
      contractId: STELLAR_CONFIG.contractId, routerId: STELLAR_CONFIG.routerId,
      proofCount, explorerUrl: STELLAR_CONFIG.explorerUrl,
      contractExplorer: client.explorerContract() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // ── Prove ──────────────────────────────────────────────────────────────────
  if (action === 'prove' || !action) {
    const rl = rateLimit(`zk-prove:${ip}`, 'ai-chat')
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const proofId = randomUUID()
    const start   = Date.now()

    try {
      const { signal, rule, decision, portfolioUSD, peakUSD, startUSD,
              tradesToday, totalTrades, config } = body

      const proofInput = buildTradeProofInput({ signal, rule, decision,
        portfolioUSD, peakUSD, startUSD, tradesToday, totalTrades, config })

      let output: TradeProofOutput
      let sealHex: string, imageIdHex: string, journalDigestHex: string, journalJson: string

      if (ZK_MODE === 'mock') {
        ;({ output, sealHex, imageIdHex, journalDigestHex, journalJson } =
            buildMockReceipt(proofInput, proofId))
      } else {
        ;({ output, sealHex, imageIdHex, journalDigestHex, journalJson } =
            await runRealProver(proofInput))
      }

      if (!output.valid) {
        return NextResponse.json({
          success: false, proofId, output, sealHex, imageIdHex, journalDigestHex, journalJson,
          elapsedMs: Date.now() - start, error: `Proof invalid: ${output.attestation}`,
        }, { status: 422 })
      }

      return NextResponse.json({
        success: true, proofId, output, sealHex, imageIdHex, journalDigestHex, journalJson,
        elapsedMs: Date.now() - start,
      })
    } catch (err: any) {
      return NextResponse.json({
        success: false, proofId, output: null, sealHex: '', imageIdHex: '',
        journalDigestHex: '', journalJson: '', elapsedMs: Date.now() - start, error: err.message,
      }, { status: 500 })
    }
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  if (action === 'verify') {
    const rl = rateLimit(`zk-verify:${ip}`, 'ai-chat')
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { proofId, sealHex, journalDigestHex, journalJson } = body

    if (!proofId || !sealHex || !journalDigestHex || !journalJson) {
      return NextResponse.json({ error: 'proofId, sealHex, journalDigestHex, journalJson required' }, { status: 400 })
    }

    try {
      if (STELLAR_MOCK) {
        mockProofCounter++
        const mockTxId = `mock_tx_${proofId.replace(/-/g, '').slice(0, 16)}`
        return NextResponse.json({ success: true, proofId, stellarTxId: mockTxId,
          proofIndex: mockProofCounter, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockTxId}` })
      }
      const client = getStellarClient()
      const result = await client.verifyTradeProof({ sealHex, journalDigestHex, journalJson })
      return NextResponse.json({ success: true, proofId, stellarTxId: result.txHash,
        proofIndex: result.proofIndex, explorerUrl: result.explorerUrl })
    } catch (err: any) {
      return NextResponse.json({ success: false, proofId, stellarTxId: null,
        proofIndex: null, explorerUrl: null, error: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action must be: prove | verify' }, { status: 400 })
}

// ─────────────────────────────────────────────────────────────────────────────

async function runRealProver(input: object): Promise<{
  output: TradeProofOutput; sealHex: string; imageIdHex: string; journalDigestHex: string; journalJson: string
}> {
  const inputJSON = JSON.stringify(input)
  return new Promise((resolve, reject) => {
    const proc = spawn(ZK_HOST_BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) { reject(new Error(`Prover exited ${code}: ${stderr.slice(0, 500)}`)); return }
      try {
        const r = JSON.parse(stdout.trim())
        resolve({
          output:            r.output,
          sealHex:           r.sealHex,
          imageIdHex:        r.imageIdHex,
          journalDigestHex:  r.journalDigestHex,
          journalJson:       JSON.stringify(r.output),
        })
      } catch (e: any) { reject(new Error(`Parse error: ${e.message}`)) }
    })
    proc.on('error', (e) => reject(new Error(`Spawn failed: ${e.message}. Set ZK_PROVER_MODE=mock for dev.`)))
    proc.stdin.write(inputJSON)
    proc.stdin.end()
  })
}

function buildMockReceipt(input: any, proofId: string): {
  output: TradeProofOutput; sealHex: string; imageIdHex: string; journalDigestHex: string; journalJson: string
} {
  const portfolioUSD = input.portfolio_usd ?? 10000
  const peakUSD      = input.peak_usd ?? portfolioUSD
  const drawdownPct  = peakUSD > 0 ? Math.max(0, ((peakUSD - portfolioUSD) / peakUSD) * 100) : 0
  const tradeSizePct = portfolioUSD > 0 ? (input.decision.amount_usdt / portfolioUSD) * 100 : 0
  const cfg          = input.config

  const output: TradeProofOutput = {
    valid: true, symbol: input.decision.symbol, action: input.decision.action,
    amount_usdt: input.decision.amount_usdt, rule_id: input.rule.id, rule_name: input.rule.name,
    drawdown_pct: drawdownPct, drawdown_ok: drawdownPct < cfg.max_drawdown_pct,
    trade_size_pct: tradeSizePct, trade_size_ok: tradeSizePct <= cfg.max_per_trade_pct,
    daily_trades_ok: input.trades_today < cfg.max_daily_trades, condition_fired: true,
    decided_at_ms: input.decided_at_ms, dry_run: cfg.dry_run,
    attestation: `[Binalyst ZK MOCK] VALID | ${input.decision.action} ${input.decision.symbol} | proofId: ${proofId}`,
  }

  const journalJson = JSON.stringify(output)
  // Mock 32-byte digest + image_id (not cryptographically real)
  const mockDigest  = Buffer.alloc(32, proofId.charCodeAt(0) % 256).toString('hex')
  const mockImageId = Buffer.alloc(32, 0xAB).toString('hex')
  const mockSeal    = Buffer.concat([Buffer.from([0x31,0,0,0]), Buffer.alloc(256, proofId.charCodeAt(1) % 256)]).toString('hex')

  return { output, sealHex: mockSeal, imageIdHex: mockImageId, journalDigestHex: mockDigest, journalJson }
}
