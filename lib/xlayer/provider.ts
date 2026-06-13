/**
 * lib/xlayer/provider.ts
 * Session 1: Ethers.js provider + wallet helpers for X Layer.
 *
 * SAFE: Entirely new file. The existing TWAKClient in lib/twak/client.ts
 * handles BSC only and is untouched. This is a parallel client for X Layer.
 */

import { ethers }                                          from 'ethers'
import { XLAYER_RPC_PRIMARY, XLAYER_RPC_BACKUP, XLAYER_CHAIN_ID } from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Provider factory — falls back to backup RPC on failure
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: any; // You can replace 'any' with 'EthereumProvider' if you have the types installed
  }
}

export function getXLayerProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(XLAYER_RPC_PRIMARY, {
    chainId: XLAYER_CHAIN_ID,
    name:    'xlayer',
  })
}

export function getXLayerProviderBackup(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(XLAYER_RPC_BACKUP, {
    chainId: XLAYER_CHAIN_ID,
    name:    'xlayer',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// XLayerClient — mirrors TWAKClient API shape for easy use in UI
// ─────────────────────────────────────────────────────────────────────────────

export class XLayerClient {
  private provider: ethers.JsonRpcProvider
  private wallet:   ethers.Wallet
  public  address:  string

  constructor(privateKey: string) {
    this.provider = getXLayerProvider()
    this.wallet   = new ethers.Wallet(privateKey, this.provider)
    this.address  = this.wallet.address
  }

  /** OKB native balance */
  async getOKBBalance(): Promise<number> {
    try {
      const bal = await this.provider.getBalance(this.address)
      return parseFloat(ethers.formatEther(bal))
    } catch {
      // Fallback to backup RPC
      const backup = getXLayerProviderBackup()
      const bal = await backup.getBalance(this.address)
      return parseFloat(ethers.formatEther(bal))
    }
  }

  /** ERC-20 token balance on X Layer */
  async getTokenBalance(tokenAddress: string, decimals = 18): Promise<number> {
    if (!tokenAddress) return 0
    const abi = [
      'function balanceOf(address) view returns (uint256)',
    ]
    try {
      const contract = new ethers.Contract(tokenAddress, abi, this.provider)
      const bal      = await contract.balanceOf(this.address)
      return parseFloat(ethers.formatUnits(bal, decimals))
    } catch { return 0 }
  }

  /** Current chain ID check — confirm we are on X Layer */
  async verifyChain(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork()
      return Number(network.chainId) === XLAYER_CHAIN_ID
    } catch { return false }
  }

  /** Latest block — used for liveness check */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber()
    } catch { return 0 }
  }

  /** Sign arbitrary message (for submission verification) */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message)
  }

  /** Get transaction receipt — used to confirm Hook deploy */
  async getReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(txHash)
    } catch { return null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only helpers — no private key needed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a contract is deployed at an address on X Layer.
 * Used to verify the Hook contract after deployment.
 */
export async function isContractDeployed(address: string): Promise<boolean> {
  try {
    const provider = getXLayerProvider()
    const code     = await provider.getCode(address)
    return code !== '0x'
  } catch { return false }
}

/**
 * Get OKB balance for any address — read-only, no wallet needed.
 */
export async function getOKBBalanceForAddress(address: string): Promise<number> {
  try {
    const provider = getXLayerProvider()
    const bal      = await provider.getBalance(address)
    return parseFloat(ethers.formatEther(bal))
  } catch { return 0 }
}

/**
 * Estimate gas for a transaction — used before Hook deploy.
 */
export async function estimateGas(tx: ethers.TransactionRequest): Promise<bigint> {
  try {
    const provider = getXLayerProvider()
    return await provider.estimateGas(tx)
  } catch { return BigInt(0) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser wallet (MetaMask/OKX Wallet) helpers
// Called client-side only — window.ethereum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request wallet to switch to X Layer.
 * If chain not added yet, prompts user to add it.
 */
export async function switchToXLayer(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return { success: false, error: 'No web3 wallet detected' }
  }

  const { XLAYER_NETWORK_PARAMS } = await import('./config')

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: XLAYER_NETWORK_PARAMS.chainId }],
    })
    return { success: true }
  } catch (switchError: any) {
    // 4902 = chain not added yet
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [XLAYER_NETWORK_PARAMS],
        })
        return { success: true }
      } catch (addError: any) {
        return { success: false, error: addError.message }
      }
    }
    return { success: false, error: switchError.message }
  }
}

/**
 * Switch back to BSC (BNB Smart Chain).
 */
export async function switchToBSC(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return { success: false, error: 'No web3 wallet detected' }
  }

  const { BSC_NETWORK_PARAMS } = await import('./config')

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_NETWORK_PARAMS.chainId }],
    })
    return { success: true }
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_NETWORK_PARAMS],
        })
        return { success: true }
      } catch (addError: any) {
        return { success: false, error: addError.message }
      }
    }
    return { success: false, error: switchError.message }
  }
}

/**
 * Get current connected chain ID from browser wallet.
 */
export async function getConnectedChainId(): Promise<number | null> {
  if (typeof window === 'undefined' || !window.ethereum) return null
  try {
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
    return parseInt(chainIdHex, 16)
  } catch { return null }
}
