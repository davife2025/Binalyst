/**
 * lib/croo/usdcPayment.ts
 * Session 6 — USDC Payment Rail
 *
 * Handles everything needed for Binalyst to PAY other CAP agents in USDC:
 *  1. Check USDC balance on BSC
 *  2. Estimate gas before sending
 *  3. Send USDC ERC-20 transfer to target agent wallet
 *  4. Wait for confirmation + return txHash
 *  5. Dry-run mode (estimate only, no broadcast)
 *
 * Uses the same ethers v6 pattern as lib/twak/client.ts.
 * NEW FILE — zero modifications to existing files.
 *
 * Used by: app/api/cap/pay/route.ts  (S6 new)
 *          app/api/cap/call/route.ts  (S6 patch — adds live payment before calling)
 *          components/tabs/CrooTab.tsx (S6 patch — payment confirmation UX in OutboundPanel)
 */

import { ethers } from 'ethers'
import { BSC_RPC, BSC_RPC_BACKUP } from '@/lib/twak/client'

// ── Constants ─────────────────────────────────────────────────────────────────

// USDC on BSC (18 decimals — note: BSC USDC uses 18, not 6 like Ethereum)
export const USDC_BSC_ADDRESS  = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
export const USDC_BSC_DECIMALS = 18

// Minimum USDC to hold for gas buffer (keep 0.5 USDC equivalent in BNB)
export const GAS_BUFFER_BNB = 0.002   // ~$1 worth of BNB at typical prices

// ERC-20 minimal ABI (transfer + balanceOf + allowance)
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentEstimate {
  canPay:          boolean
  usdcBalance:     number
  bnbBalance:      number
  requiredUSDC:    number
  estimatedGasETH: number    // gas cost in BNB
  estimatedGasUSD: number    // gas cost in USD approx
  shortfallUSDC?:  number
  error?:          string
}

export interface PaymentResult {
  success:     boolean
  txHash?:     string
  bscScan?:    string
  blockNumber?: number
  gasUsed?:    string
  confirmedAt?: number
  error?:      string
  dryRun:      boolean
}

export interface PaymentOpts {
  privateKey:   string       // agent's private key
  toAddress:    string       // target agent's wallet
  amountUSDC:   number       // USDC to send
  dryRun?:      boolean      // estimate only, no broadcast (default: true)
  gasPriceBump?: number      // multiply gas price by this (default: 1.1)
  timeoutMs?:   number       // tx confirmation timeout (default: 60000)
}

// ── Provider with fallback ────────────────────────────────────────────────────

function getProvider(): ethers.JsonRpcProvider {
  try {
    return new ethers.JsonRpcProvider(BSC_RPC)
  } catch {
    return new ethers.JsonRpcProvider(BSC_RPC_BACKUP)
  }
}

// ── Balance check ─────────────────────────────────────────────────────────────

export async function getUSDCBalance(address: string): Promise<number> {
  try {
    const provider = getProvider()
    const usdc     = new ethers.Contract(USDC_BSC_ADDRESS, ERC20_ABI, provider)
    const raw: bigint = await usdc.balanceOf(address)
    return Number(ethers.formatUnits(raw, USDC_BSC_DECIMALS))
  } catch (err: any) {
    console.error('[usdcPayment] getUSDCBalance:', err.message)
    return 0
  }
}

export async function getBNBBalance(address: string): Promise<number> {
  try {
    const provider = getProvider()
    const raw      = await provider.getBalance(address)
    return Number(ethers.formatEther(raw))
  } catch {
    return 0
  }
}

// ── Payment estimate ──────────────────────────────────────────────────────────

export async function estimatePayment(opts: {
  fromAddress: string
  toAddress:   string
  amountUSDC:  number
}): Promise<PaymentEstimate> {
  const { fromAddress, toAddress, amountUSDC } = opts

  try {
    const provider    = getProvider()
    const usdcBalance = await getUSDCBalance(fromAddress)
    const bnbBalance  = await getBNBBalance(fromAddress)

    // Estimate gas for ERC-20 transfer
    const usdc      = new ethers.Contract(USDC_BSC_ADDRESS, ERC20_ABI, provider)
    const amountWei = ethers.parseUnits(amountUSDC.toFixed(USDC_BSC_DECIMALS), USDC_BSC_DECIMALS)

    let gasLimit  = BigInt(65_000)   // typical ERC-20 transfer gas
    let gasPrice  = BigInt(3_000_000_000) // 3 gwei default

    try {
      const [estimatedGas, feeData] = await Promise.all([
        usdc.transfer.estimateGas(toAddress, amountWei, { from: fromAddress }).catch(() => gasLimit),
        provider.getFeeData(),
      ])
      gasLimit = estimatedGas
      gasPrice = feeData.gasPrice ?? gasPrice
    } catch { /* use defaults */ }

    const gasCostBNB = Number(ethers.formatEther(gasLimit * gasPrice))
    // Approximate BNB/USD price for gas estimate display
    const bnbUsdApprox = 600
    const gasCostUSD   = gasCostBNB * bnbUsdApprox

    const canPay       = usdcBalance >= amountUSDC && bnbBalance >= gasCostBNB + GAS_BUFFER_BNB
    const shortfall    = canPay ? undefined : Math.max(0, amountUSDC - usdcBalance)

    return {
      canPay,
      usdcBalance,
      bnbBalance,
      requiredUSDC:    amountUSDC,
      estimatedGasETH: gasCostBNB,
      estimatedGasUSD: gasCostUSD,
      shortfallUSDC:   shortfall,
    }

  } catch (err: any) {
    return {
      canPay:          false,
      usdcBalance:     0,
      bnbBalance:      0,
      requiredUSDC:    amountUSDC,
      estimatedGasETH: 0,
      estimatedGasUSD: 0,
      error:           err.message,
    }
  }
}

// ── Send USDC payment ─────────────────────────────────────────────────────────

export async function sendUSDCPayment(opts: PaymentOpts): Promise<PaymentResult> {
  const {
    privateKey,
    toAddress,
    amountUSDC,
    dryRun      = true,
    gasPriceBump = 1.1,
    timeoutMs   = 60_000,
  } = opts

  // ── Dry-run: estimate only ──────────────────────────────────────────────
  if (dryRun) {
    try {
      const provider = getProvider()
      const wallet   = new ethers.Wallet(privateKey, provider)
      const estimate = await estimatePayment({
        fromAddress: wallet.address,
        toAddress,
        amountUSDC,
      })

      return {
        success:  estimate.canPay,
        dryRun:   true,
        txHash:   undefined,
        error:    estimate.canPay
          ? undefined
          : estimate.shortfallUSDC
            ? `Insufficient USDC — need $${amountUSDC}, have $${estimate.usdcBalance.toFixed(4)} (shortfall: $${estimate.shortfallUSDC.toFixed(4)})`
            : estimate.error ?? 'Insufficient balance',
      }
    } catch (err: any) {
      return { success: false, dryRun: true, error: err.message }
    }
  }

  // ── Live payment ────────────────────────────────────────────────────────
  try {
    const provider  = getProvider()
    const wallet    = new ethers.Wallet(privateKey, provider)
    const usdc      = new ethers.Contract(USDC_BSC_ADDRESS, ERC20_ABI, wallet)
    const amountWei = ethers.parseUnits(amountUSDC.toFixed(USDC_BSC_DECIMALS), USDC_BSC_DECIMALS)

    // Pre-flight balance check
    const [usdcBal, bnbBal] = await Promise.all([
      getUSDCBalance(wallet.address),
      getBNBBalance(wallet.address),
    ])

    if (usdcBal < amountUSDC) {
      return {
        success: false,
        dryRun:  false,
        error:   `Insufficient USDC: have $${usdcBal.toFixed(4)}, need $${amountUSDC}`,
      }
    }
    if (bnbBal < GAS_BUFFER_BNB) {
      return {
        success: false,
        dryRun:  false,
        error:   `Insufficient BNB for gas: have ${bnbBal.toFixed(6)} BNB, need ~${GAS_BUFFER_BNB} BNB`,
      }
    }

    // Get current gas price and bump for faster confirmation
    const feeData  = await provider.getFeeData()
    const gasPrice = BigInt(Math.floor(Number(feeData.gasPrice ?? BigInt(3_000_000_000)) * gasPriceBump))

    // Send transfer
    const tx = await usdc.transfer(toAddress, amountWei, {
      gasLimit: BigInt(100_000),
      gasPrice,
    })

    // Wait for confirmation with timeout
    const receipt = await Promise.race([
      tx.wait(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tx confirmation timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]) as ethers.TransactionReceipt

    if (!receipt || receipt.status !== 1) {
      return {
        success: false,
        dryRun:  false,
        txHash:  tx.hash,
        error:   'Transaction reverted on-chain',
      }
    }

    return {
      success:     true,
      dryRun:      false,
      txHash:      tx.hash,
      bscScan:     `https://bscscan.com/tx/${tx.hash}`,
      blockNumber: receipt.blockNumber,
      gasUsed:     receipt.gasUsed.toString(),
      confirmedAt: Date.now(),
    }

  } catch (err: any) {
    return { success: false, dryRun: false, error: err.message }
  }
}

// ── Pay-then-call helper ──────────────────────────────────────────────────────
// Convenience: send USDC then return the txHash ready for the CAP request

export async function payAndGetTxHash(opts: {
  privateKey:  string
  toAddress:   string
  amountUSDC:  number
  dryRun?:     boolean
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  const result = await sendUSDCPayment({
    privateKey:  opts.privateKey,
    toAddress:   opts.toAddress,
    amountUSDC:  opts.amountUSDC,
    dryRun:      opts.dryRun ?? true,
  })

  if (!result.success) {
    return { txHash: '', success: false, error: result.error }
  }

  // Dry-run returns no real txHash — use DEMO sentinel
  return {
    txHash:  result.txHash ?? 'DEMO',
    success: true,
  }
}
