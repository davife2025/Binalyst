#!/usr/bin/env bash
# scripts/deploy-recorder.sh — NEW (Session P2)
#
# Deploys Binalyst's own recorder contract (our-contract/) and initialises it
# with the router address from scripts/deploy-verifier.sh + the guest image_id
# from `cargo risczero build`.
#
# Run AFTER:
#   1. scripts/deploy-verifier.sh   (deploys the real NethermindEth router)
#   2. cargo risczero build         (produces BINALYST_IMAGE_ID)
#
# Usage:
#   source .env.stellar
#   bash scripts/deploy-recorder.sh

set -euo pipefail

echo "🚀 Binalyst — deploy recorder contract"
echo "=============================================="

if [[ -f .env.stellar ]]; then source .env.stellar; fi

: "${STELLAR_SECRET_KEY:?  Set STELLAR_SECRET_KEY in .env.stellar}"
: "${STELLAR_ROUTER_ID:?    Set STELLAR_ROUTER_ID — run scripts/deploy-verifier.sh first}"
: "${BINALYST_IMAGE_ID:?    Set BINALYST_IMAGE_ID — run cargo risczero build first}"

STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

STELLAR_PUBLIC_KEY=$(stellar keys address --secret-key "$STELLAR_SECRET_KEY" 2>/dev/null || \
  stellar keys public-key --secret-key "$STELLAR_SECRET_KEY")
echo "✓ Deployer: $STELLAR_PUBLIC_KEY"

echo ""
echo "Building recorder contract (Wasm)..."
stellar contract build --package binalyst-zk-recorder
WASM_PATH="target/wasm32-unknown-unknown/release/binalyst_zk_recorder.wasm"
echo "✓ Built: $WASM_PATH"

echo ""
echo "Uploading + deploying..."
WASM_HASH=$(stellar contract upload \
  --network "$STELLAR_NETWORK" --source "$STELLAR_SECRET_KEY" \
  --wasm "$WASM_PATH" --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE")

CONTRACT_ID=$(stellar contract deploy \
  --network "$STELLAR_NETWORK" --source "$STELLAR_SECRET_KEY" \
  --wasm-hash "$WASM_HASH" --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE")
echo "✓ Recorder contract ID: $CONTRACT_ID"

echo ""
echo "Initialising (admin + router + image_id)..."
stellar contract invoke \
  --network "$STELLAR_NETWORK" --source "$STELLAR_SECRET_KEY" \
  --id "$CONTRACT_ID" --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
  -- initialise \
  --admin "$STELLAR_PUBLIC_KEY" \
  --router "$STELLAR_ROUTER_ID" \
  --image_id "$BINALYST_IMAGE_ID"
echo "✓ Initialised"

if grep -q "STELLAR_CONTRACT_ID" .env.stellar 2>/dev/null; then
  sed -i.bak "s|STELLAR_CONTRACT_ID=.*|STELLAR_CONTRACT_ID=$CONTRACT_ID|" .env.stellar
else
  echo "STELLAR_CONTRACT_ID=$CONTRACT_ID" >> .env.stellar
fi

echo ""
echo "=============================================="
echo "✅ Recorder deployed and wired to router!"
echo ""
echo "Recorder contract : $CONTRACT_ID"
echo "Router contract    : $STELLAR_ROUTER_ID"
echo "Explorer           : https://stellar.expert/explorer/${STELLAR_NETWORK}/contract/${CONTRACT_ID}"
echo ""
echo "STELLAR_CONTRACT_ID written to .env.stellar"
echo "Copy STELLAR_CONTRACT_ID, STELLAR_ROUTER_ID, BINALYST_IMAGE_ID into .env.local"
echo "=============================================="
