#!/usr/bin/env bash
# scripts/deploy-verifier.sh
#
# Build the Soroban verifier contract and deploy it to Stellar testnet.
# Run from the repo root after completing Session O (so you have the image_id).
#
# Prerequisites:
#   • Rust + cargo (from Session O setup.sh)
#   • stellar CLI  — https://developers.stellar.org/docs/tools/developer-tools/cli/install
#   • A funded testnet keypair in STELLAR_SECRET_KEY (see .env.stellar.example)
#
# Usage:
#   cp .env.stellar.example .env.stellar
#   # Edit .env.stellar — fill in STELLAR_SECRET_KEY and BINALYST_IMAGE_ID
#   source .env.stellar
#   bash scripts/deploy-verifier.sh

set -euo pipefail

echo "🚀 Binalyst — Soroban verifier deploy"
echo "========================================"

# ── Load env ──────────────────────────────────────────────────────────────────
if [[ -f .env.stellar ]]; then
  # shellcheck source=/dev/null
  source .env.stellar
fi

: "${STELLAR_SECRET_KEY:?  Set STELLAR_SECRET_KEY in .env.stellar}"
: "${BINALYST_IMAGE_ID:?    Set BINALYST_IMAGE_ID (from cargo risczero build output) in .env.stellar}"

STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

echo "Network : $STELLAR_NETWORK"
echo "RPC URL : $STELLAR_RPC_URL"
echo ""

# ── 1. Install stellar CLI (if missing) ───────────────────────────────────────
if ! command -v stellar &>/dev/null; then
  echo "Installing Stellar CLI..."
  cargo install --locked stellar-cli --features opt
fi
echo "✓ Stellar CLI $(stellar --version)"

# ── 2. Derive public key ───────────────────────────────────────────────────────
STELLAR_PUBLIC_KEY=$(stellar keys public-key \
  --secret-key "$STELLAR_SECRET_KEY" 2>/dev/null || \
  stellar keys address --secret-key "$STELLAR_SECRET_KEY")
echo "✓ Deployer: $STELLAR_PUBLIC_KEY"

# ── 3. Fund account on testnet (friendbot) ────────────────────────────────────
if [[ "$STELLAR_NETWORK" == "testnet" ]]; then
  echo "Funding via Friendbot..."
  curl -s "https://friendbot.stellar.org?addr=$STELLAR_PUBLIC_KEY" > /dev/null && echo "✓ Funded"
fi

# ── 4. Patch image_id into the contract source ────────────────────────────────
# Convert hex image_id to Rust byte array literal
IMAGE_ID_HEX="${BINALYST_IMAGE_ID//0x/}"
IMAGE_ID_RUST=$(echo "$IMAGE_ID_HEX" | sed 's/../0x&, /g' | sed 's/, $//')

echo "Patching image_id into soroban-verifier/src/lib.rs..."
sed -i.bak \
  "s|0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,\\n    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,\\n    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,\\n    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,|$IMAGE_ID_RUST,|" \
  soroban-verifier/src/lib.rs
echo "✓ image_id patched"

# ── 5. Build the Wasm ─────────────────────────────────────────────────────────
echo ""
echo "Building Soroban contract (release Wasm)..."
stellar contract build --package binalyst-soroban-verifier
WASM_PATH="target/wasm32-unknown-unknown/release/binalyst_soroban_verifier.wasm"
echo "✓ Built: $WASM_PATH ($(du -sh "$WASM_PATH" | cut -f1))"

# ── 6. Upload Wasm to Stellar ──────────────────────────────────────────────────
echo ""
echo "Uploading Wasm to $STELLAR_NETWORK..."
WASM_HASH=$(stellar contract upload \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SECRET_KEY" \
  --wasm "$WASM_PATH" \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE")
echo "✓ Wasm hash: $WASM_HASH"

# ── 7. Deploy contract ────────────────────────────────────────────────────────
echo ""
echo "Deploying contract..."
CONTRACT_ID=$(stellar contract deploy \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SECRET_KEY" \
  --wasm-hash "$WASM_HASH" \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE")
echo "✓ Contract ID: $CONTRACT_ID"

# ── 8. Initialise contract ────────────────────────────────────────────────────
echo ""
echo "Initialising contract (setting admin)..."
stellar contract invoke \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SECRET_KEY" \
  --id "$CONTRACT_ID" \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
  -- initialise \
  --admin "$STELLAR_PUBLIC_KEY"
echo "✓ Contract initialised"

# ── 9. Write contract ID to .env.stellar ──────────────────────────────────────
if grep -q "STELLAR_CONTRACT_ID" .env.stellar 2>/dev/null; then
  sed -i.bak "s|STELLAR_CONTRACT_ID=.*|STELLAR_CONTRACT_ID=$CONTRACT_ID|" .env.stellar
else
  echo "" >> .env.stellar
  echo "STELLAR_CONTRACT_ID=$CONTRACT_ID" >> .env.stellar
fi

echo ""
echo "=============================================="
echo "✅ Session P complete!"
echo ""
echo "Contract ID : $CONTRACT_ID"
echo "Network     : $STELLAR_NETWORK"
echo "Explorer    : https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "STELLAR_CONTRACT_ID has been written to .env.stellar"
echo ""
echo "Next: run Session Q (proof API routes) and set STELLAR_CONTRACT_ID"
echo "      in your .env.local / Vercel environment."
echo "=============================================="
