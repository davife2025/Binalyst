// app/api/zk/prove/route.ts
//
// POST /api/zk/prove
//
// Generates a RISC Zero ZK proof for a Binalyst trade decision.
//
// Flow:
//   1. Receive ZKProveRequest (signal + rule + decision + portfolio state)
//   2. Serialise to TradeProofInput JSON
//   3. Spawn the RISC Zero host binary (binalyst-zk-host) which:
//      a. Reads TradeProofInput from stdin
//      b. Runs the guest ELF inside the zkVM
//      c. Outputs a base64-encoded receipt to stdout
//   4. Parse the receipt → extract journal (TradeProofOutput) + seal
//   5. Return ZKProveResponse with receipt bytes and parsed output
//
// The RISC Zero host binary is built separately from the Rust workspace.
// In development, set ZK_PROVER_MODE=mock to skip real proof generation
// and return a deterministic mock receipt (fast, for UI development).

import { NextRequest, NextResponse } from 'next/server'
import { spawn }                     from 'child_process'
import { randomUUID }                from 'crypto'
import { rateLimit }                 from '@/lib/rateLimit'
import { buildTradeProofInput }      from '@/lib/stellar/serialise'
import type { ZKProveRequest, ZKProveResponse, TradeProofOutput } from '@/lib/stellar/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300   // proof generation can take up to 5 min on slow hardware

// Path to the compiled RISC Zero host binary.
// Build with: cargo build --release -p binalyst-zk-host
// (Session O produces the guest; the host is a thin wrapper — see README)
const ZK_HOST_BIN = process.env.ZK_HOST_BIN ?? './target/release/binalyst-zk-host'
const ZK_MODE     = process.env.ZK_PROVER_MODE ?? 'real'   // 'real' | 'mock'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`zk-prove:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const proofId = randomUUID()
  const start   = Date.now()

  try {
    const body: ZKProveRequest = await req.json()
    const { signal, rule, decision, portfolioUSD, peakUSD, startUSD,
            tradesToday, totalTrades, config } = body

    // ── Build guest input ───────────────────────────────────────────────────
    const proofInput = buildTradeProofInput({
      signal, rule, decision,
      portfolioUSD, peakUSD, startUSD,
      tradesToday, totalTrades, config,
    })

    // ── Generate proof ──────────────────────────────────────────────────────
    let output:     TradeProofOutput
    let receiptB64: string
    let sealHex:    string
    let journalHex: string

    if (ZK_MODE === 'mock') {
      // Mock mode — instant, no zkVM, for UI development
      ;({ output, receiptB64, sealHex, journalHex } =
          buildMockReceipt(proofInput, proofId))
    } else {
      // Real mode — spawn the RISC Zero host prover
      ;({ output, receiptB64, sealHex, journalHex } =
          await runRealProver(proofInput))
    }

    if (!output.valid) {
      return NextResponse.json<ZKProveResponse>({
        success:    false,
        proofId,
        output,
        receiptB64,
        sealHex,
        journalHex,
        elapsedMs:  Date.now() - start,
        error:      `Proof invalid: ${output.attestation}`,
      }, { status: 422 })
    }

    return NextResponse.json<ZKProveResponse>({
      success: true,
      proofId,
      output,
      receiptB64,
      sealHex,
      journalHex,
      elapsedMs: Date.now() - start,
    })

  } catch (err: any) {
    console.error('[zk/prove]', err.message)
    return NextResponse.json<ZKProveResponse>({
      success:    false,
      proofId,
      output:     null as any,
      receiptB64: '',
      sealHex:    '',
      journalHex: '',
      elapsedMs:  Date.now() - start,
      error:      err.message,
    }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real prover — spawns binalyst-zk-host binary
// ─────────────────────────────────────────────────────────────────────────────

async function runRealProver(input: object): Promise<{
  output:     TradeProofOutput
  receiptB64: string
  sealHex:    string
  journalHex: string
}> {
  const inputJSON = JSON.stringify(input)

  return new Promise((resolve, reject) => {
    const proc = spawn(ZK_HOST_BIN, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`RISC Zero prover exited with code ${code}: ${stderr.slice(0, 500)}`))
        return
      }

      try {
        // Host binary outputs JSON: { receiptB64, sealHex, journalHex, output }
        const result = JSON.parse(stdout.trim())
        resolve({
          output:     result.output     as TradeProofOutput,
          receiptB64: result.receiptB64 as string,
          sealHex:    result.sealHex    as string,
          journalHex: result.journalHex as string,
        })
      } catch (e: any) {
        reject(new Error(`Failed to parse prover output: ${e.message} — stdout: ${stdout.slice(0, 200)}`))
      }
    })

    proc.on('error', (e) => {
      reject(new Error(
        `Failed to spawn prover at ${ZK_HOST_BIN}: ${e.message}. ` +
        `Run 'cargo build --release -p binalyst-zk-host' first, ` +
        `or set ZK_PROVER_MODE=mock for UI development.`
      ))
    })

    // Write input JSON to stdin
    proc.stdin.write(inputJSON)
    proc.stdin.end()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock prover — deterministic, instant, for development
// ─────────────────────────────────────────────────────────────────────────────

function buildMockReceipt(input: any, proofId: string): {
  output:     TradeProofOutput
  receiptB64: string
  sealHex:    string
  journalHex: string
} {
  const portfolioUSD  = input.portfolio_usd ?? 10000
  const peakUSD       = input.peak_usd      ?? portfolioUSD
  const drawdownPct   = peakUSD > 0
    ? Math.max(0, ((peakUSD - portfolioUSD) / peakUSD) * 100)
    : 0
  const tradeSizePct  = portfolioUSD > 0
    ? (input.decision.amount_usdt / portfolioUSD) * 100
    : 0
  const cfg           = input.config

  const output: TradeProofOutput = {
    valid:            true,
    symbol:           input.decision.symbol,
    action:           input.decision.action,
    amount_usdt:      input.decision.amount_usdt,
    rule_id:          input.rule.id,
    rule_name:        input.rule.name,
    drawdown_pct:     drawdownPct,
    drawdown_ok:      drawdownPct < cfg.max_drawdown_pct,
    trade_size_pct:   tradeSizePct,
    trade_size_ok:    tradeSizePct <= cfg.max_per_trade_pct,
    daily_trades_ok:  input.trades_today < cfg.max_daily_trades,
    condition_fired:  true,   // mock: assume condition fired
    decided_at_ms:    input.decided_at_ms,
    dry_run:          cfg.dry_run,
    attestation:
      `[Binalyst ZK MOCK] VALID | ${input.decision.action} ${input.decision.symbol} ` +
      `${input.decision.amount_usdt.toFixed(2)} USDT | rule: "${input.rule.name}" | ` +
      `ts: ${input.decided_at_ms} | proofId: ${proofId}`,
  }

  // Mock receipt — deterministic bytes derived from proofId
  // Seal: 4-byte selector + 256 bytes of mock proof data
  const selector    = Buffer.from([0x31, 0x00, 0x00, 0x00])   // RISC Zero Groth16 selector
  const mockSeal    = Buffer.concat([selector, Buffer.alloc(256, proofId.charCodeAt(0) % 256)])
  const mockJournal = Buffer.from(JSON.stringify(output), 'utf8')
  const mockReceipt = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x01]),  // version
    mockSeal,
    Buffer.from([0x00, 0x00]),              // separator
    mockJournal,
  ])

  return {
    output,
    receiptB64: mockReceipt.toString('base64'),
    sealHex:    mockSeal.toString('hex'),
    journalHex: mockJournal.toString('hex'),
  }
}
