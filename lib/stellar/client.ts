// lib/stellar/client.ts
//
// Binalyst Stellar SDK client.
// Submits verified RISC Zero receipts to the Soroban verifier contract.
//
// Uses @stellar/stellar-sdk (install: npm i @stellar/stellar-sdk)

import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import type { StellarProofRecord } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Config (from environment)
// ─────────────────────────────────────────────────────────────────────────────

const RPC_URL     = process.env.STELLAR_RPC_URL     ?? 'https://soroban-testnet.stellar.org'
const CONTRACT_ID = process.env.STELLAR_CONTRACT_ID ?? ''
const SECRET_KEY  = process.env.STELLAR_SECRET_KEY  ?? ''
const NETWORK     = process.env.STELLAR_NETWORK     ?? 'testnet'
const EXPLORER    = process.env.STELLAR_EXPLORER_URL ?? 'https://stellar.expert/explorer/testnet'

const NETWORK_PASSPHRASE =
  NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export class StellarVerifierClient {
  private server:   SorobanRpc.Server
  private contract: Contract
  private keypair:  Keypair

  constructor() {
    if (!CONTRACT_ID) throw new Error('STELLAR_CONTRACT_ID not set in environment')
    if (!SECRET_KEY)  throw new Error('STELLAR_SECRET_KEY not set in environment')

    this.server   = new SorobanRpc.Server(RPC_URL, { allowHttp: false })
    this.contract = new Contract(CONTRACT_ID)
    this.keypair  = Keypair.fromSecret(SECRET_KEY)
  }

  get publicKey(): string {
    return this.keypair.publicKey()
  }

  explorerTx(txHash: string): string {
    return `${EXPLORER}/tx/${txHash}`
  }

  explorerContract(): string {
    return `${EXPLORER}/contract/${CONTRACT_ID}`
  }

  // ── verify_trade_proof ─────────────────────────────────────────────────────
  //
  // Submits a RISC Zero receipt to the Soroban verifier contract.
  //
  // Parameters:
  //   sealHex    — hex-encoded Groth16 proof bytes (from /api/zk/prove)
  //   journalHex — hex-encoded journal bytes (from /api/zk/prove)
  //
  // Returns the on-chain proof index and Stellar transaction hash.

  async verifyTradeProof(sealHex: string, journalHex: string): Promise<{
    proofIndex:  number
    txHash:      string
    explorerUrl: string
    ledger:      number
  }> {
    const account = await this.server.getAccount(this.keypair.publicKey())

    const sealBytes    = Buffer.from(sealHex,    'hex')
    const journalBytes = Buffer.from(journalHex, 'hex')

    // Build the Soroban transaction
    const tx = new TransactionBuilder(account, {
      fee:            BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        this.contract.call(
          'verify_trade_proof',
          nativeToScVal(this.keypair.publicKey(), { type: 'address' }),
          xdr.ScVal.scvBytes(sealBytes),
          xdr.ScVal.scvBytes(journalBytes),
        )
      )
      .setTimeout(60)
      .build()

    // Simulate to get resource footprint + fee
    const simResult = await this.server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Soroban simulation failed: ${simResult.error}`)
    }

    // Assemble + sign + submit
    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build()
    preparedTx.sign(this.keypair)

    const sendResult = await this.server.sendTransaction(preparedTx)
    if (sendResult.status === 'ERROR') {
      throw new Error(`Stellar tx failed: ${JSON.stringify(sendResult.errorResult)}`)
    }

    // Poll for confirmation
    const txHash = sendResult.hash
    const confirmed = await this.pollForConfirmation(txHash)

    // Extract return value (proof index u32)
    const returnVal = confirmed.returnValue
    const proofIndex = returnVal
      ? (scValToNative(returnVal) as number)
      : 0

    return {
      proofIndex,
      txHash,
      explorerUrl: this.explorerTx(txHash),
      ledger:      confirmed.ledger ?? 0,
    }
  }

  // ── proof_count ────────────────────────────────────────────────────────────

  async proofCount(): Promise<number> {
    const result = await this.server.simulateTransaction(
      await this.buildReadTx('proof_count', [])
    )
    if (SorobanRpc.Api.isSimulationError(result)) return 0
    return result.result?.retval
      ? (scValToNative(result.result.retval) as number)
      : 0
  }

  // ── get_recent_proofs ──────────────────────────────────────────────────────

  async getRecentProofs(n: number): Promise<StellarProofRecord[]> {
    const result = await this.server.simulateTransaction(
      await this.buildReadTx('get_recent_proofs', [
        nativeToScVal(n, { type: 'u32' }),
      ])
    )
    if (SorobanRpc.Api.isSimulationError(result)) return []
    const raw = result.result?.retval
      ? scValToNative(result.result.retval)
      : []
    return (raw as any[]).map(mapProofRecord)
  }

  // ── get_proof ──────────────────────────────────────────────────────────────

  async getProof(index: number): Promise<StellarProofRecord | null> {
    try {
      const result = await this.server.simulateTransaction(
        await this.buildReadTx('get_proof', [
          nativeToScVal(index, { type: 'u32' }),
        ])
      )
      if (SorobanRpc.Api.isSimulationError(result)) return null
      const raw = result.result?.retval
        ? scValToNative(result.result.retval)
        : null
      return raw ? mapProofRecord(raw) : null
    } catch {
      return null
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async buildReadTx(method: string, args: xdr.ScVal[]) {
    const account = await this.server.getAccount(this.keypair.publicKey())
    return new TransactionBuilder(account, {
      fee:            BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build()
  }

  private async pollForConfirmation(
    txHash: string,
    maxAttempts = 20,
    intervalMs  = 2000,
  ): Promise<SorobanRpc.Api.GetSuccessfulTransactionResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(intervalMs)
      const status = await this.server.getTransaction(txHash)
      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return status as SorobanRpc.Api.GetSuccessfulTransactionResponse
      }
      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Stellar tx ${txHash} failed on-chain`)
      }
    }
    throw new Error(`Stellar tx ${txHash} not confirmed after ${maxAttempts} attempts`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapProofRecord(raw: any): StellarProofRecord {
  return {
    index:               Number(raw.index             ?? 0),
    symbol:              String(raw.symbol             ?? ''),
    action:              String(raw.action             ?? ''),
    amount_usdt_cents:   Number(raw.amount_usdt_cents  ?? 0),
    rule_id:             String(raw.rule_id            ?? ''),
    rule_name:           String(raw.rule_name          ?? ''),
    drawdown_bps:        Number(raw.drawdown_bps       ?? 0),
    dry_run:             Boolean(raw.dry_run),
    decided_at_ms:       Number(raw.decided_at_ms      ?? 0),
    verified_at_ledger:  Number(raw.verified_at_ledger ?? 0),
    receipt_fingerprint: String(raw.receipt_fingerprint ?? ''),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Singleton — avoids re-creating keypair / server on every request
let _client: StellarVerifierClient | null = null

export function getStellarClient(): StellarVerifierClient {
  if (!_client) _client = new StellarVerifierClient()
  return _client
}

// Export config values for use in UI
export const STELLAR_CONFIG = {
  network:     NETWORK,
  contractId:  CONTRACT_ID,
  explorerUrl: EXPLORER,
  rpcUrl:      RPC_URL,
}
