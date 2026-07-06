// lib/stellar/client.ts — REWRITTEN (Session P2)
//
// Updated to match the real verification flow:
//   binalyst-zk-host now outputs { sealHex, imageIdHex, journalDigestHex, output }
//   instead of the old { sealHex, journalHex }.
//
// Our Soroban contract (our-contract/src/lib.rs) calls:
//   verify_trade_proof(caller, seal, journal_digest, journal_json) -> u32
// which internally calls NethermindEth's router.verify(seal, image_id, journal_digest).
// image_id is stored in our contract at initialise() time, not passed per-call.

import {
  Contract, Keypair, Networks, SorobanRpc,
  TransactionBuilder, xdr, nativeToScVal, scValToNative, BASE_FEE,
} from '@stellar/stellar-sdk'
import type { StellarProofRecord } from './types'

const RPC_URL      = process.env.STELLAR_RPC_URL      ?? 'https://soroban-testnet.stellar.org'
const CONTRACT_ID  = process.env.STELLAR_CONTRACT_ID  ?? ''   // our recorder contract
const ROUTER_ID     = process.env.STELLAR_ROUTER_ID    ?? ''   // NethermindEth router (informational)
const SECRET_KEY    = process.env.STELLAR_SECRET_KEY   ?? ''
const NETWORK       = process.env.STELLAR_NETWORK      ?? 'testnet'
const EXPLORER      = process.env.STELLAR_EXPLORER_URL ?? 'https://stellar.expert/explorer/testnet'

const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

export class StellarVerifierClient {
  private server:   SorobanRpc.Server
  private contract: Contract
  private keypair:  Keypair

  constructor() {
    if (!CONTRACT_ID) throw new Error('STELLAR_CONTRACT_ID not set (our recorder contract — see scripts/deploy-recorder.sh)')
    if (!SECRET_KEY)  throw new Error('STELLAR_SECRET_KEY not set')

    this.server   = new SorobanRpc.Server(RPC_URL, { allowHttp: false })
    this.contract = new Contract(CONTRACT_ID)
    this.keypair  = Keypair.fromSecret(SECRET_KEY)
  }

  get publicKey(): string { return this.keypair.publicKey() }
  explorerTx(txHash: string): string { return `${EXPLORER}/tx/${txHash}` }
  explorerContract(): string { return `${EXPLORER}/contract/${CONTRACT_ID}` }

  /**
   * Submit a trade proof to our recorder contract, which delegates the actual
   * cryptographic verification to the NethermindEth router (already deployed
   * in scripts/deploy-verifier.sh).
   *
   * Parameters come directly from binalyst-zk-host's output:
   *   sealHex            — Groth16 seal (encode_seal format)
   *   journalDigestHex    — sha256(journal), NOT the raw journal
   *   journalJson         — raw journal bytes, used only for the audit log
   */
  async verifyTradeProof(params: {
    sealHex:          string
    journalDigestHex: string
    journalJson:      string   // raw JSON string of TradeProofOutput
  }): Promise<{ proofIndex: number; txHash: string; explorerUrl: string; ledger: number }> {
    const account = await this.server.getAccount(this.keypair.publicKey())

    const sealBytes           = Buffer.from(params.sealHex, 'hex')
    const journalDigestBytes  = Buffer.from(params.journalDigestHex, 'hex')
    const journalJsonBytes    = Buffer.from(params.journalJson, 'utf8')

    if (journalDigestBytes.length !== 32) {
      throw new Error(`journalDigestHex must be 32 bytes, got ${journalDigestBytes.length}`)
    }

    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(
        this.contract.call(
          'verify_trade_proof',
          nativeToScVal(this.keypair.publicKey(), { type: 'address' }),
          xdr.ScVal.scvBytes(sealBytes),
          xdr.ScVal.scvBytes(journalDigestBytes),   // BytesN<32> on the Rust side
          xdr.ScVal.scvBytes(journalJsonBytes),
        )
      )
      .setTimeout(60)
      .build()

    const simResult = await this.server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Soroban simulation failed: ${simResult.error}`)
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build()
    preparedTx.sign(this.keypair)

    const sendResult = await this.server.sendTransaction(preparedTx)
    if (sendResult.status === 'ERROR') {
      throw new Error(`Stellar tx failed: ${JSON.stringify(sendResult.errorResult)}`)
    }

    const txHash    = sendResult.hash
    const confirmed = await this.pollForConfirmation(txHash)
    const proofIndex = confirmed.returnValue
      ? (scValToNative(confirmed.returnValue) as number)
      : 0

    return { proofIndex, txHash, explorerUrl: this.explorerTx(txHash), ledger: confirmed.ledger ?? 0 }
  }

  async proofCount(): Promise<number> {
    const result = await this.server.simulateTransaction(await this.buildReadTx('proof_count', []))
    if (SorobanRpc.Api.isSimulationError(result)) return 0
    return result.result?.retval ? (scValToNative(result.result.retval) as number) : 0
  }

  async getRecentProofs(n: number): Promise<StellarProofRecord[]> {
    const result = await this.server.simulateTransaction(
      await this.buildReadTx('get_recent_proofs', [nativeToScVal(n, { type: 'u32' })])
    )
    if (SorobanRpc.Api.isSimulationError(result)) return []
    const raw = result.result?.retval ? scValToNative(result.result.retval) : []
    return (raw as any[]).map(mapProofRecord)
  }

  async getProof(index: number): Promise<StellarProofRecord | null> {
    try {
      const result = await this.server.simulateTransaction(
        await this.buildReadTx('get_proof', [nativeToScVal(index, { type: 'u32' })])
      )
      if (SorobanRpc.Api.isSimulationError(result)) return null
      const raw = result.result?.retval ? scValToNative(result.result.retval) : null
      return raw ? mapProofRecord(raw) : null
    } catch { return null }
  }

  private async buildReadTx(method: string, args: xdr.ScVal[]) {
    const account = await this.server.getAccount(this.keypair.publicKey())
    return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build()
  }

  private async pollForConfirmation(txHash: string, maxAttempts = 20, intervalMs = 2000) {
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

function mapProofRecord(raw: any): StellarProofRecord {
  return {
    index:               Number(raw.index ?? 0),
    symbol:              String(raw.symbol ?? ''),
    action:              String(raw.action ?? ''),
    amount_usdt_cents:   Number(raw.amount_usdt_cents ?? 0),
    rule_id:             String(raw.rule_id ?? ''),
    rule_name:           String(raw.rule_name ?? ''),
    drawdown_bps:        Number(raw.drawdown_bps ?? 0),
    dry_run:             Boolean(raw.dry_run),
    decided_at_ms:       Number(raw.decided_at_ms ?? 0),
    verified_at_ledger:  Number(raw.verified_at_ledger ?? 0),
    receipt_fingerprint: String(raw.journal_fingerprint ?? ''),
  }
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

let _client: StellarVerifierClient | null = null
export function getStellarClient(): StellarVerifierClient {
  if (!_client) _client = new StellarVerifierClient()
  return _client
}

export const STELLAR_CONFIG = {
  network:     NETWORK,
  contractId:  CONTRACT_ID,
  routerId:    ROUTER_ID,
  explorerUrl: EXPLORER,
  rpcUrl:      RPC_URL,
}
