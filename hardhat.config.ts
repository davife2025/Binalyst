/**
 * hardhat.config.ts
 * Session 2 — Hardhat configuration for WorldCupHook.
 *
 * Usage:
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 *   npx hardhat compile
 *   npx ts-node contracts/deploy.ts
 *
 * SAFE: New file. Does not interfere with the Next.js build.
 * Hardhat only runs when explicitly invoked — it is not part of
 * `next dev` or `next build`.
 */

import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x' + '0'.repeat(64)

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs:    200,
      },
      viaIR: true,
    },
  },

  networks: {
    // X Layer Mainnet
    xlayer: {
      url:      'https://rpc.xlayer.tech',
      chainId:  196,
      accounts: [DEPLOYER_KEY],
      gasPrice: 'auto',
    },

    // X Layer Testnet (for testing before mainnet)
    xlayerTestnet: {
      url:      'https://testrpc.xlayer.tech',
      chainId:  195,
      accounts: [DEPLOYER_KEY],
    },

    // Local Hardhat network (fast iteration)
    hardhat: {
      chainId: 31337,
    },
  },

  // OKLink block explorer verification (same as Etherscan API)
  etherscan: {
    apiKey: {
      xlayer: process.env.OKLINK_API_KEY ?? '',
    },
    customChains: [
      {
        network:  'xlayer',
        chainId:  196,
        urls: {
          apiURL:      'https://www.oklink.com/api/v5/explorer/contract/verify-source-code',
          browserURL:  'https://www.oklink.com/xlayer',
        },
      },
    ],
  },

  paths: {
    sources:   './contracts',
    tests:     './contracts/test',
    cache:     './contracts/.cache',
    artifacts: './contracts/artifacts',
  },
}

export default config
