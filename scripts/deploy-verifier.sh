#!/usr/bin/env bash
# scripts/deploy-verifier.sh — REWRITTEN (Session P2)
#
# Deploys the REAL NethermindEth stellar-risc0-verifier stack:
#   TimelockController + VerifierRouter + Groth16Verifier + EmergencyStop
#
# This REPLACES the old Session P / PATCH2 approach, which incorrectly
# tried to hand-roll a BN254 pairing check and fetch nonexistent VK constants.
# The real repo ships a working, deployable verifier system with a CLI
# (manage.sh) that handles all of this correctly.
#
# What this script does:
#   1. Clones github.com/NethermindEth/stellar-risc0-verifier (if not present)
#   2. Deploys the timelocked router (./scripts/manage.sh deploy-router)
#   3. Deploys the Groth16Verifier + EmergencyStop (deploy-verifier)
#   4. Registers the verifier in the router (schedule + execute add-verifier)
#   5. Writes the router contract ID to .env.stellar as STELLAR_ROUTER_ID
#
# Usage:
#   cp .env.stellar.example .env.stellar
#   # Fill in STELLAR_SECRET_KEY (or use `stellar keys generate`)
#   source .env.stellar
#   bash scripts/deploy-verifier.sh

set -euo pipefail

VERIFIER_REPO_URL="https://github.com/NethermindEth/stellar-risc0-verifier.git"
VERIFIER_DIR="vendor/stellar-risc0-verifier"

echo "🚀 Binalyst — deploy RISC Zero verifier stack on Stellar"
echo "=============================================="

# ── Load env ──────────────────────────────────────────────────────────────────
if [[ -f .env.stellar ]]; then
  source .env.stellar
fi

STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
DEPLOYER_KEY_NAME="${STELLAR_KEY_NAME:-binalyst-deployer}"
TIMELOCK_MIN_DELAY="${STELLAR_TIMELOCK_DELAY:-0}"   # 0 for testnet, 604800 (7d) for mainnet

# ── 1. Stellar CLI ────────────────────────────────────────────────────────────
if ! command -v stellar &>/dev/null; then
  echo "Installing Stellar CLI..."
  cargo install --locked stellar-cli
fi
echo "✓ Stellar CLI $(stellar --version | head -1)"

# ── 2. Clone the real Nethermind verifier repo ─────────────────────────────────
mkdir -p vendor
if [[ ! -d "$VERIFIER_DIR" ]]; then
  echo "Cloning $VERIFIER_REPO_URL..."
  git clone "$VERIFIER_REPO_URL" "$VERIFIER_DIR"
else
  echo "✓ $VERIFIER_DIR already present — pulling latest"
  (cd "$VERIFIER_DIR" && git pull --ff-only)
fi

# ── 3. Set up deployer key ────────────────────────────────────────────────────
cd "$VERIFIER_DIR"

if ! stellar keys address "$DEPLOYER_KEY_NAME" &>/dev/null; then
  echo "Generating deployer key: $DEPLOYER_KEY_NAME"
  stellar keys generate "$DEPLOYER_KEY_NAME" --network "$STELLAR_NETWORK"
fi

if [[ "$STELLAR_NETWORK" == "testnet" ]]; then
  echo "Funding deployer via Friendbot..."
  stellar keys fund "$DEPLOYER_KEY_NAME" --network "$STELLAR_NETWORK" || echo "  (already funded or funding failed — continuing)"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$DEPLOYER_KEY_NAME")
echo "✓ Deployer: $DEPLOYER_ADDRESS"

# ── 4. Deploy the timelocked router ───────────────────────────────────────────
echo ""
echo "Deploying router + timelock (min-delay=${TIMELOCK_MIN_DELAY})..."
./scripts/manage.sh deploy-router \
  -n "$STELLAR_NETWORK" \
  -a "$DEPLOYER_KEY_NAME" \
  --min-delay "$TIMELOCK_MIN_DELAY"

echo "✓ Router deployed"
./scripts/manage.sh status -n "$STELLAR_NETWORK"

# ── 5. Deploy the Groth16Verifier + EmergencyStop ─────────────────────────────
echo ""
echo "Deploying Groth16Verifier + EmergencyStop..."
DEPLOY_OUTPUT=$(./scripts/manage.sh deploy-verifier -n "$STELLAR_NETWORK" -a "$DEPLOYER_KEY_NAME")
echo "$DEPLOY_OUTPUT"

# Extract the selector from deployment.toml
SELECTOR=$(python3 ./scripts/toml_helper.py read deployment.toml "chains.stellar-${STELLAR_NETWORK}.verifiers.0.selector")
echo "✓ Verifier deployed. Selector: $SELECTOR"

# ── 6. Register the verifier in the router (timelocked, 2-step) ──────────────
echo ""
echo "Scheduling add-verifier..."
./scripts/manage.sh schedule-add-verifier \
  -n "$STELLAR_NETWORK" -a "$DEPLOYER_KEY_NAME" \
  --selector "$SELECTOR"

if [[ "$TIMELOCK_MIN_DELAY" -gt 0 ]]; then
  echo "⚠  Timelock delay is ${TIMELOCK_MIN_DELAY}s — wait before executing."
  echo "   Run this once the delay has passed:"
  echo "   (cd $VERIFIER_DIR && ./scripts/manage.sh execute-add-verifier -n $STELLAR_NETWORK -a $DEPLOYER_KEY_NAME --selector $SELECTOR)"
else
  echo "Executing add-verifier (delay=0)..."
  ./scripts/manage.sh execute-add-verifier \
    -n "$STELLAR_NETWORK" -a "$DEPLOYER_KEY_NAME" \
    --selector "$SELECTOR"
  echo "✓ Verifier registered in router"
fi

# ── 7. Extract router contract ID and write to .env.stellar ──────────────────
ROUTER_ID=$(python3 ./scripts/toml_helper.py read deployment.toml "chains.stellar-${STELLAR_NETWORK}.router")

cd - > /dev/null  # back to repo root

if grep -q "STELLAR_ROUTER_ID" .env.stellar 2>/dev/null; then
  sed -i.bak "s|STELLAR_ROUTER_ID=.*|STELLAR_ROUTER_ID=$ROUTER_ID|" .env.stellar
else
  echo "" >> .env.stellar
  echo "STELLAR_ROUTER_ID=$ROUTER_ID" >> .env.stellar
fi

if grep -q "STELLAR_VERIFIER_SELECTOR" .env.stellar 2>/dev/null; then
  sed -i.bak "s|STELLAR_VERIFIER_SELECTOR=.*|STELLAR_VERIFIER_SELECTOR=$SELECTOR|" .env.stellar
else
  echo "STELLAR_VERIFIER_SELECTOR=$SELECTOR" >> .env.stellar
fi

echo ""
echo "=============================================="
echo "✅ Verifier stack deployed!"
echo ""
echo "Router contract ID : $ROUTER_ID"
echo "Verifier selector  : $SELECTOR"
echo "Network            : $STELLAR_NETWORK"
echo "Explorer           : https://stellar.expert/explorer/${STELLAR_NETWORK}/contract/${ROUTER_ID}"
echo ""
echo "STELLAR_ROUTER_ID and STELLAR_VERIFIER_SELECTOR written to .env.stellar"
echo ""
echo "Next: run scripts/build-guest-host.sh to build the RISC Zero guest + host,"
echo "then set STELLAR_ROUTER_ID in .env.local for the Next.js app."
echo "=============================================="
