/**
 * app/api/celo-agent/loop/route.ts — Session K (new file)
 *
 * Server-side Celo Payments Agent loop trigger. Parallel to
 * app/api/agent/loop/route.ts (BNB competition agent) but fully
 * independent — separate client (CeloClient), separate guardrails
 * (checkPaymentGuardrails), separate rate-limit bucket.
 *
 * For each enabled PaymentRule whose frequency window has elapsed, checks
 * guardrails and — depending on config.dryRun / config.autonomousMode —
 * either simulates or actually sends a CELO/cUSD payment ("real-world
 * payments & everyday applications" per the Onchain Agents Hackathon brief).
 */

import { NextRequest, NextResponse } from 'next/server'
import { CeloClient, checkPaymentGuardrails } from '@/lib/celo/client'
import type { CeloNetwork } from '@/lib/celo/config'
import { CELO_TOKENS } from '@/lib/celo/config'
import { isPaymentDue } from '@/lib/celoAgentLoop'
import type { PaymentRule, PaymentRecord } from '@/lib/celoAgentLoop'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`celo-loop:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const body = await req.json()
    const {
      privateKey,
      network      = 'alfajores',
      rules        = [],
      paymentsToday = 0,
      config       = {},
    } = body as {
      privateKey: string
      network: CeloNetwork
      rules: PaymentRule[]
      paymentsToday: number
      config: { dryRun?: boolean; autonomousMode?: boolean }
    }

    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 })

    const dryRun         = config.dryRun ?? true
    const autonomousMode = config.autonomousMode ?? false

    const client = new CeloClient(privateKey, network)

    // ── 1. Portfolio snapshot ──────────────────────────────────────────────
    const { celo, cusd, celoPriceUSD, totalUSD } = await client.getPortfolioValueUSD()

    // ── 2. Evaluate due payment rules ──────────────────────────────────────
    const now = Date.now()
    const due = (rules ?? []).filter(r => isPaymentDue(r, now))

    const payments: PaymentRecord[] = []
    const updatedRules: PaymentRule[] = [...rules]
    let executed = 0
    let blocked  = 0
    let totalUSDSentThisCycle = 0
    const errors: string[] = []

    for (const rule of due) {
      const ruleIdx = updatedRules.findIndex(r => r.id === rule.id)
      const tokenInfo = CELO_TOKENS[network]?.[rule.token]

      if (!tokenInfo) {
        errors.push(`${rule.label}: ${rule.token} not configured on Celo ${network}`)
        continue
      }

      const tokenBalance = rule.token === 'cUSD' ? cusd : celo
      const amountUSD    = rule.token === 'cUSD' ? rule.amount : rule.amount * celoPriceUSD

      const guardrail = checkPaymentGuardrails({
        tokenSymbol:   rule.token,
        network,
        amount:        rule.amount,
        tokenBalance,
        celoBalance:   celo,
        amountUSD,
        paymentsToday: paymentsToday + executed,
      })

      const baseRecord = {
        id:        crypto.randomUUID(),
        timestamp: now,
        ruleId:    rule.id,
        ruleLabel: rule.label,
        recipient: rule.recipient,
        token:     rule.token,
        amount:    rule.amount,
        amountUSD,
        dryRun,
      }

      if (!guardrail.allowed) {
        payments.push({ ...baseRecord, txHash: '', status: 'blocked', reason: guardrail.reason })
        blocked++
        continue
      }

      if (dryRun) {
        // Simulate — mark as paid so the schedule advances, but send nothing.
        payments.push({ ...baseRecord, txHash: '', status: 'simulated' })
        if (ruleIdx >= 0) updatedRules[ruleIdx] = { ...rule, lastPaidAt: now }
        executed++
        totalUSDSentThisCycle += amountUSD
        continue
      }

      if (!autonomousMode) {
        payments.push({
          ...baseRecord, txHash: '', status: 'blocked',
          reason: 'Autonomous mode disabled — enable it to send real payments.',
        })
        blocked++
        continue
      }

      // ── Live execution ────────────────────────────────────────────────
      try {
        const result = rule.token === 'cUSD'
          ? await client.sendCUSD(rule.recipient, rule.amount)
          : await client.sendCELO(rule.recipient, rule.amount)

        if (result.success) {
          payments.push({ ...baseRecord, txHash: result.txHash, status: 'confirmed' })
          if (ruleIdx >= 0) updatedRules[ruleIdx] = { ...rule, lastPaidAt: now }
          executed++
          totalUSDSentThisCycle += amountUSD
        } else {
          payments.push({ ...baseRecord, txHash: '', status: 'failed', reason: result.error })
          errors.push(`${rule.label}: ${result.error ?? 'send failed'}`)
        }
      } catch (e: any) {
        payments.push({ ...baseRecord, txHash: '', status: 'failed', reason: e.message })
        errors.push(`${rule.label}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success:      true,
      status:       'running',
      totalUSD,
      celoBalance:  celo,
      cusdBalance:  cusd,
      celoPriceUSD,
      payments,
      executed,
      blocked,
      errors,
      totalUSDSentThisCycle,
      updatedRules,
      cycleAt: now,
    })
  } catch (err: any) {
    console.error('[celo-agent/loop]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
