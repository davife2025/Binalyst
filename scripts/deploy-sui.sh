#!/usr/bin/env bash
# scripts/deploy-sui.sh
#
# Deploy the Binalyst agent_policy Move package to Sui testnet.
# Captures the package ID and writes it to .env.local automatically.
#
# Usage:
#   bash scripts/deploy-sui.sh              # deploy to testnet (default)
#   bash scripts/deploy-sui.sh mainnet      # deploy to mainnet
#
# Prerequisites:
#   - Sui CLI installed: https://docs.sui.io/guides/developer/getting-started/sui-install
#   - Active wallet with testnet SUI for gas (sui client faucet)
#   - Run from project root (where move/ folder is)

set -e

NETWORK="${1:-testnet}"
MOVE_DIR="$(dirname "$0")/../move"
ENV_FILE=".env.local"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Binalyst — Sui Move Package Deploy                 ║"
echo "║   Sui Overflow 2026 · Agentic Web · Sub-track 2      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────

if ! command -v sui &> /dev/null; then
  echo "✗ Sui CLI not found."
  echo "  Install from: https://docs.sui.io/guides/developer/getting-started/sui-install"
  exit 1
fi

echo "✓ Sui CLI found: $(sui --version)"
echo ""

# Switch to correct network
echo "→ Switching to ${NETWORK}..."
sui client switch --env "$NETWORK" 2>&1 | grep -v "^$" || true

# Show active address
ACTIVE_ADDR=$(sui client active-address 2>/dev/null || echo "none")
echo "  Active address: ${ACTIVE_ADDR}"
echo ""

# Check balance
echo "→ Checking gas balance..."
SUI_BALANCE=$(sui client balance 2>/dev/null | grep "SUI" | head -1 || echo "unknown")
echo "  Balance: ${SUI_BALANCE}"
echo ""

if [ "$NETWORK" = "testnet" ]; then
  echo "  Tip: if balance is low, run: sui client faucet"
  echo ""
fi

# ── Publish ───────────────────────────────────────────────────────────────────

echo "→ Publishing move/ package to ${NETWORK}..."
echo ""

PUBLISH_OUTPUT=$(sui client publish \
  --gas-budget 100000000 \
  "$MOVE_DIR" \
  2>&1)

echo "$PUBLISH_OUTPUT"
echo ""

# ── Extract package ID ────────────────────────────────────────────────────────

PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -A1 "PackageID\|Published Objects\|package_id\|objectId" | \
  grep -oE '0x[0-9a-fA-F]{64}' | head -1)

if [ -z "$PACKAGE_ID" ]; then
  # Try alternative grep for different CLI output formats
  PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -oE '"packageId":"0x[0-9a-fA-F]+"' | \
    grep -oE '0x[0-9a-fA-F]+' | head -1)
fi

if [ -z "$PACKAGE_ID" ]; then
  echo "✗ Could not extract package ID from publish output."
  echo "  Copy it manually from the output above and add to ${ENV_FILE}:"
  echo "  NEXT_PUBLIC_POLICY_PACKAGE_ID=0x<your-package-id>"
  exit 1
fi

echo "✓ Package deployed: ${PACKAGE_ID}"
echo ""

# ── Write to .env.local ───────────────────────────────────────────────────────

# Remove existing entry if present
if [ -f "$ENV_FILE" ]; then
  sed -i.bak '/^NEXT_PUBLIC_POLICY_PACKAGE_ID=/d' "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
fi

echo "NEXT_PUBLIC_POLICY_PACKAGE_ID=${PACKAGE_ID}" >> "$ENV_FILE"

echo "✓ Written to ${ENV_FILE}:"
echo "  NEXT_PUBLIC_POLICY_PACKAGE_ID=${PACKAGE_ID}"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Deploy complete                                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Network:    ${NETWORK}"
echo "  Package ID: ${PACKAGE_ID}"
echo "  Env file:   ${ENV_FILE}"
echo ""
echo "Next steps:"
echo "  1. Restart the dev server:  npm run dev"
echo "  2. Open Sui Agent tab → Policy → Deploy policy on Sui ${NETWORK}"
echo "  3. Query on-chain events:"
echo "     sui client events \\"
echo "       --query '{\"MoveEventType\": \"${PACKAGE_ID}::agent_policy::TradeExecuted\"}' \\"
echo "       --limit 10"
echo ""
echo "Verify at: https://suiscan.xyz/${NETWORK}/package/${PACKAGE_ID}"
echo ""
