#!/usr/bin/env bash
# setup.sh — Session O bootstrap
# Run once from the Binalyst repo root after dropping in these files.
set -euo pipefail

echo "🔧 Session O — RISC Zero guest setup"
echo "======================================"

# ── 1. Check Rust ──────────────────────────────────────────────────────────
if ! command -v cargo &>/dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
fi
echo "✓ Rust $(rustc --version)"

# ── 2. Install cargo-risczero ─────────────────────────────────────────────
if ! command -v cargo-risczero &>/dev/null; then
  echo "Installing cargo-risczero..."
  cargo install cargo-risczero
fi
echo "✓ cargo-risczero $(cargo risczero --version)"

# ── 3. Install RISC Zero zkVM toolchain ───────────────────────────────────
echo "Installing RISC Zero zkVM toolchain (this may take a few minutes)..."
cargo risczero install
echo "✓ zkVM toolchain installed"

# ── 4. Run unit tests (no zkVM needed) ────────────────────────────────────
echo ""
echo "Running unit tests..."
cargo test -p binalyst-zk-guest
echo "✓ All tests passed"

# ── 5. Build the guest ELF ────────────────────────────────────────────────
echo ""
echo "Building guest ELF..."
cargo risczero build
echo "✓ Build complete"

# ── 6. Extract and display the image_id ───────────────────────────────────
echo ""
echo "=============================================="
echo "Session O complete!"
echo ""
echo "Next steps:"
echo "  1. Note the image_id printed above — you'll hard-code it in Session P"
echo "     (the Soroban verifier contract)."
echo "  2. Run Session P to deploy the Stellar verifier."
echo "  3. Run Session Q to add the Next.js proof API routes."
echo ""
echo "Session P files will be delivered as session-P.zip"
echo "=============================================="
