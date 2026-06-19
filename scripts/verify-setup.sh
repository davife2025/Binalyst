#!/usr/bin/env bash
# scripts/verify-setup.sh
#
# Preflight checklist — run before switching to ZK_PROVER_MODE=real.
# Checks every prerequisite and prints a clear pass/fail for each.
#
# Usage:
#   source .env.stellar && source .env.local && bash scripts/verify-setup.sh

set -uo pipefail

PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✓  $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗  $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠  $1"; WARN=$((WARN+1)); }
header() { echo ""; echo "── $1 ──"; }

echo ""
echo "🔍 Binalyst × Stellar ZK — preflight check"
echo "=============================================="

# ── Rust toolchain ─────────────────────────────────────────────────────────────
header "Rust toolchain"
if command -v rustc &>/dev/null; then
  ok "rustc $(rustc --version | cut -d' ' -f2)"
else
  fail "rustc not found — install Rust: https://rustup.rs"
fi

if command -v cargo-risczero &>/dev/null; then
  ok "cargo-risczero $(cargo risczero --version 2>/dev/null | head -1)"
else
  fail "cargo-risczero not found — run: cargo install cargo-risczero"
fi

# ── Guest ELF built ────────────────────────────────────────────────────────────
header "RISC Zero guest"
GUEST_ELF="target/riscv-guest/riscv32im-risc0-zkvm-elf/release/binalyst-zk-guest"
if [[ -f "$GUEST_ELF" ]]; then
  ok "Guest ELF found: $GUEST_ELF"
else
  fail "Guest ELF not found — run: cargo risczero build"
fi

# ── image_id placeholder check ─────────────────────────────────────────────────
header "image_id"
PLACEHOLDER_ZEROS="0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00"
if grep -q "$PLACEHOLDER_ZEROS" soroban-verifier/src/lib.rs 2>/dev/null; then
  fail "BINALYST_IMAGE_ID is still all-zeros placeholder in soroban-verifier/src/lib.rs"
  fail "Run: cargo risczero build, then bash scripts/deploy-verifier.sh"
else
  ok "image_id is patched in soroban-verifier/src/lib.rs"
fi

# ── VK constants check ─────────────────────────────────────────────────────────
header "Verification key (VK) constants"
if grep -q "BytesN::from_array(env, &\[0u8;" soroban-verifier/src/lib.rs 2>/dev/null; then
  fail "VK constants still contain placeholder zeros"
  fail "Run: bash scripts/fetch-vk.sh"
else
  ok "VK constants are filled in soroban-verifier/src/lib.rs"
fi

# ── Host binary ────────────────────────────────────────────────────────────────
header "ZK host binary"
ZK_BIN="${ZK_HOST_BIN:-./target/release/binalyst-zk-host}"
if [[ -f "$ZK_BIN" ]]; then
  ok "Host binary: $ZK_BIN"
else
  fail "Host binary not found at: $ZK_BIN"
  fail "Run: cargo build --release -p binalyst-zk-host"
  fail "Then set ZK_HOST_BIN=$ZK_BIN in .env.local"
fi

# ── Stellar CLI ────────────────────────────────────────────────────────────────
header "Stellar CLI"
if command -v stellar &>/dev/null; then
  ok "stellar CLI $(stellar --version | head -1)"
else
  warn "stellar CLI not found — needed for deploy"
  warn "Run: cargo install --locked stellar-cli --features opt"
fi

# ── Environment variables ──────────────────────────────────────────────────────
header "Environment variables"

check_env() {
  local var="$1"
  local val="${!var:-}"
  local prefix="${2:-}"
  if [[ -n "$val" ]]; then
    if [[ -n "$prefix" ]]; then
      ok "$var=${prefix}..."
    else
      ok "$var is set"
    fi
  else
    fail "$var is not set"
  fi
}

check_env "STELLAR_SECRET_KEY"  "S"
check_env "STELLAR_CONTRACT_ID" "C"
check_env "STELLAR_RPC_URL"
check_env "ZK_HOST_BIN"
check_env "ZK_PROVER_MODE"
check_env "STELLAR_MOCK"

# Mode check
ZK_MODE="${ZK_PROVER_MODE:-mock}"
STELLAR_MOCK_VAL="${STELLAR_MOCK:-true}"
if [[ "$ZK_MODE" == "real" && "$STELLAR_MOCK_VAL" == "false" ]]; then
  ok "Both real modes enabled: ZK_PROVER_MODE=real, STELLAR_MOCK=false"
elif [[ "$ZK_MODE" == "mock" && "$STELLAR_MOCK_VAL" == "true" ]]; then
  warn "Both in mock mode — ZK_PROVER_MODE=mock, STELLAR_MOCK=true (development mode)"
else
  warn "Mixed modes: ZK_PROVER_MODE=$ZK_MODE, STELLAR_MOCK=$STELLAR_MOCK_VAL"
fi

# ── Stellar connectivity ───────────────────────────────────────────────────────
header "Stellar testnet"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
if curl -sf --max-time 5 "$RPC_URL/health" &>/dev/null || \
   curl -sf --max-time 5 "$RPC_URL" &>/dev/null; then
  ok "Stellar RPC reachable: $RPC_URL"
else
  warn "Could not reach Stellar RPC: $RPC_URL"
fi

CONTRACT_ID="${STELLAR_CONTRACT_ID:-}"
if [[ -n "$CONTRACT_ID" ]]; then
  ok "STELLAR_CONTRACT_ID: ${CONTRACT_ID:0:8}…"
else
  fail "STELLAR_CONTRACT_ID not set — run: bash scripts/deploy-verifier.sh"
fi

# ── On-chain proof count ───────────────────────────────────────────────────────
header "On-chain state"
if [[ -n "$CONTRACT_ID" ]] && command -v stellar &>/dev/null; then
  NETWORK="${STELLAR_NETWORK:-testnet}"
  COUNT=$(stellar contract invoke \
    --network "$NETWORK" \
    --source "${STELLAR_SECRET_KEY}" \
    --id "$CONTRACT_ID" \
    -- proof_count 2>/dev/null || echo "error")
  if [[ "$COUNT" == "error" ]]; then
    warn "Could not call proof_count — contract may not be initialised"
  else
    ok "proof_count = $COUNT (on Stellar $NETWORK)"
  fi
else
  warn "Skipping on-chain check (no contract ID or stellar CLI)"
fi

# ── Node.js / npm ─────────────────────────────────────────────────────────────
header "Node.js"
if command -v node &>/dev/null; then
  ok "node $(node --version)"
else
  fail "node not found"
fi
if [[ -f "node_modules/@stellar/stellar-sdk/package.json" ]]; then
  ok "@stellar/stellar-sdk installed"
else
  fail "@stellar/stellar-sdk not installed — run: npm i @stellar/stellar-sdk"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "Results: $PASS passed · $WARN warnings · $FAIL failed"
echo ""
if [[ $FAIL -eq 0 && $WARN -le 1 ]]; then
  echo "✅ Ready to switch to real mode!"
  echo ""
  echo "Set in .env.local:"
  echo "  ZK_PROVER_MODE=real"
  echo "  STELLAR_MOCK=false"
elif [[ $FAIL -eq 0 ]]; then
  echo "⚠  Ready with warnings — review before going live"
else
  echo "✗  $FAIL prerequisite(s) failed — fix before switching to real mode"
fi
echo "=============================================="
