/**
 * contracts/deploy.ts
 * Session 2 — Deploy WorldCupHook to X Layer.
 *
 * Usage:
 *   npx ts-node contracts/deploy.ts
 *
 * Required env vars (add to .env.local — never commit):
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   ORACLE_ADDRESS=0x...          (your wallet or a keeper address)
 *   XLAYER_POOL_MANAGER=0x...     (Uniswap V4 PoolManager on X Layer — update when confirmed)
 *
 * SAFE: This is a standalone script. It does not import anything from
 * the existing BNB/BSC codebase and does not modify any existing files.
 */

import { ethers }                from 'ethers'
import { readFileSync }          from 'fs'
import { join }                  from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const XLAYER_RPC      = 'https://rpc.xlayer.tech'
const XLAYER_CHAIN_ID = 196

// Uniswap V4 PoolManager on X Layer
// ⚠  Update this once Uniswap officially deploys to X Layer mainnet
// Check: https://docs.uniswap.org/contracts/v4/deployments
const POOL_MANAGER_ADDRESS =
  process.env.XLAYER_POOL_MANAGER ?? '0x0000000000000000000000000000000000000000'

// ─────────────────────────────────────────────────────────────────────────────
// ABI (minimal — just constructor)
// ─────────────────────────────────────────────────────────────────────────────

// Full ABI for interacting with the deployed Hook
export const WORLD_CUP_HOOK_ABI = [
  // Read
  'function owner() view returns (address)',
  'function oracle() view returns (address)',
  'function currentFee() view returns (uint24)',
  'function activeMatchId() view returns (uint256)',
  'function matchCount() view returns (uint256)',
  'function getFeeStateLabel() view returns (string)',
  'function getCurrentFeePct() view returns (uint24 bips, string label)',
  'function getActiveSummary() view returns (uint256 matchId, string teamA, string teamB, uint8 state, uint24 fee, uint8 goalsA, uint8 goalsB)',
  'function getMatch(uint256 matchId) view returns (string teamA, string teamB, uint256 kickoffTime, uint256 endTime, uint8 state, uint8 goalsA, uint8 goalsB)',

  // Oracle writes
  'function createMatch(string teamA, string teamB, uint256 kickoffTime) returns (uint256 matchId)',
  'function setActiveMatch(uint256 matchId)',
  'function updateMatchState(uint256 matchId, uint8 newState)',
  'function recordGoal(uint256 matchId, string scoringTeam, bool isTeamA)',
  'function resolveGoalSpike(uint256 matchId)',

  // Admin
  'function setOracle(address newOracle)',
  'function transferOwnership(address newOwner)',
  'function emergencySetFee(uint24 fee)',

  // Events
  'event MatchStateUpdated(uint256 indexed matchId, uint8 newState, uint24 fee)',
  'event GoalScored(uint256 indexed matchId, string scoringTeam)',
  'event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 kickoff)',
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Deploy
// ─────────────────────────────────────────────────────────────────────────────

async function deploy() {
  // ── Validate env ──────────────────────────────────────────────────────────
  const privateKey    = process.env.DEPLOYER_PRIVATE_KEY
  const oracleAddress = process.env.ORACLE_ADDRESS

  if (!privateKey) {
    console.error('❌  DEPLOYER_PRIVATE_KEY not set in .env.local')
    process.exit(1)
  }
  if (!oracleAddress) {
    console.error('❌  ORACLE_ADDRESS not set in .env.local')
    process.exit(1)
  }
  if (POOL_MANAGER_ADDRESS === ethers.ZeroAddress) {
    console.warn('⚠   XLAYER_POOL_MANAGER not set — using zero address (testnet/local only)')
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(XLAYER_RPC, {
    chainId: XLAYER_CHAIN_ID,
    name:    'xlayer',
  })
  const wallet = new ethers.Wallet(privateKey, provider)

  console.log('\n🌍  Deploying WorldCupHook to X Layer')
  console.log('─'.repeat(50))
  console.log('Deployer:', wallet.address)
  console.log('Oracle:  ', oracleAddress)
  console.log('Pool Mgr:', POOL_MANAGER_ADDRESS)

  // ── Check OKB balance ─────────────────────────────────────────────────────
  const balance = await provider.getBalance(wallet.address)
  const okb     = parseFloat(ethers.formatEther(balance))
  console.log(`Balance:  ${okb.toFixed(4)} OKB`)

  if (okb < 0.01) {
    console.error('\n❌  Insufficient OKB for gas. Fund your deployer wallet first.')
    console.error('   Bridge OKB at: https://www.okx.com/xlayer/bridge')
    process.exit(1)
  }

  // ── Load compiled bytecode ────────────────────────────────────────────────
  // To compile: npx hardhat compile  (or use Remix + paste WorldCupHook.sol)
  let bytecode: string

  try {
    const artifactPath = join(
      process.cwd(),
      'artifacts/contracts/WorldCupHook.sol/WorldCupHook.json'
    )
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))
    bytecode = artifact.bytecode
    console.log('\n✓  Loaded compiled bytecode from Hardhat artifacts')
  } catch {
    console.error('\n❌  Compiled artifact not found.')
    console.error('   Run: npx hardhat compile')
    console.error('   Or compile WorldCupHook.sol in Remix and paste the bytecode below.\n')
    console.error('   Alternatively, set BYTECODE env var with the hex bytecode.')

    if (process.env.BYTECODE) {
      bytecode = process.env.BYTECODE
      console.log('✓  Using BYTECODE from env')
    } else {
      process.exit(1)
    }
  }

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log('\n🚀  Deploying contract...')

  const factory = new ethers.ContractFactory(
    WORLD_CUP_HOOK_ABI,
    bytecode,
    wallet
  )

  const contract = await factory.deploy(
    POOL_MANAGER_ADDRESS,
    oracleAddress,
    { gasLimit: 2_000_000 }
  )

  console.log('📡  Transaction hash:', contract.deploymentTransaction()?.hash)
  console.log('⏳  Waiting for confirmation...')

  await contract.waitForDeployment()

  const hookAddress = await contract.getAddress()

  console.log('\n✅  WorldCupHook deployed!')
  console.log('─'.repeat(50))
  console.log('Hook address:', hookAddress)
  console.log('Explorer:    ', `https://www.oklink.com/xlayer/address/${hookAddress}`)
  console.log('\n📋  Next steps:')
  console.log('   1. Update UNISWAP_V4_POOL_MANAGER in lib/xlayer/config.ts')
  console.log('   2. Add NEXT_PUBLIC_HOOK_ADDRESS=' + hookAddress + ' to .env.local')
  console.log('   3. Submit contract to Uniswap allowlist OR deploy via eulr.fun')
  console.log('   4. Register matches using the oracle script below\n')

  // ── Seed first match (optional) ───────────────────────────────────────────
  if (process.env.SEED_MATCHES === 'true') {
    console.log('🌱  Seeding initial matches...')
    await seedMatches(contract as ethers.Contract)
  }

  return hookAddress
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed matches — creates initial World Cup fixtures
// Run with SEED_MATCHES=true npx ts-node contracts/deploy.ts
// ─────────────────────────────────────────────────────────────────────────────

async function seedMatches(hook: ethers.Contract) {
  const now = Math.floor(Date.now() / 1000)

  const fixtures = [
    { teamA: 'Brazil',    teamB: 'Mexico',     kickoff: now + 3600  },  // 1h from now
    { teamA: 'Argentina', teamB: 'Chile',       kickoff: now + 7200  },  // 2h from now
    { teamA: 'France',    teamB: 'Germany',     kickoff: now + 86400 },  // tomorrow
    { teamA: 'Spain',     teamB: 'England',     kickoff: now + 90000 },
    { teamA: 'Portugal',  teamB: 'Netherlands', kickoff: now + 93600 },
  ]

  for (const f of fixtures) {
    const tx = await hook.createMatch(f.teamA, f.teamB, f.kickoff)
    await tx.wait()
    console.log(`  ✓  ${f.teamA} vs ${f.teamB}`)
  }

  // Set first match as active
  const setTx = await hook.setActiveMatch(1)
  await setTx.wait()
  console.log('  ✓  Match 1 set as active')
}

// ─────────────────────────────────────────────────────────────────────────────
// Oracle helper — exported for use in Binalyst API routes (Session 3)
// ─────────────────────────────────────────────────────────────────────────────

export function getHookContract(
  hookAddress: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(hookAddress, WORLD_CUP_HOOK_ABI, signerOrProvider)
}

export async function pushMatchState(
  hookAddress: string,
  signer: ethers.Signer,
  matchId: number,
  state: 0 | 1 | 2 | 3 | 4 | 5   // MatchState enum
): Promise<string> {
  const hook = getHookContract(hookAddress, signer)
  const tx   = await hook.updateMatchState(matchId, state)
  const rec  = await tx.wait()
  return rec.hash
}

export async function pushGoal(
  hookAddress: string,
  signer: ethers.Signer,
  matchId: number,
  scoringTeam: string,
  isTeamA: boolean
): Promise<string> {
  const hook = getHookContract(hookAddress, signer)
  const tx   = await hook.recordGoal(matchId, scoringTeam, isTeamA)
  const rec  = await tx.wait()
  return rec.hash
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

deploy().catch(err => {
  console.error('\n❌  Deploy failed:', err.message)
  process.exit(1)
})
