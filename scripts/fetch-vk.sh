#!/usr/bin/env bash
# scripts/fetch-vk.sh
#
# Downloads the RISC Zero Groth16 verification key constants from the
# NethermindEth stellar-risc0-verifier repo and patches them directly
# into soroban-verifier/src/lib.rs.
#
# This is the ONLY manual step that can't be automated by the deploy script.
# Run this ONCE before deploying the contract.
#
# Usage:
#   bash scripts/fetch-vk.sh
#   # Then verify the patch looks right:
#   grep -A 3 "fn vk_alpha_g1" soroban-verifier/src/lib.rs
#   # Then deploy:
#   bash scripts/deploy-verifier.sh

set -euo pipefail

VK_URL="https://raw.githubusercontent.com/NethermindEth/stellar-risc0-verifier/main/src/vk.rs"
LIB_RS="soroban-verifier/src/lib.rs"
VK_TMP="/tmp/risc0_vk.rs"

echo "🔑 Binalyst — fetch and patch RISC Zero VK constants"
echo "======================================================="

# ── 1. Download VK file ────────────────────────────────────────────────────────
echo "Downloading VK from NethermindEth..."
curl -fsSL "$VK_URL" -o "$VK_TMP"
echo "✓ Downloaded $(wc -l < "$VK_TMP") lines"

# ── 2. Extract VK byte arrays ─────────────────────────────────────────────────
# The VK file defines constants like:
#   pub const ALPHA_G1: [u8; 64] = [ 0x12, 0x34, ... ];
# We extract the byte array contents and reformat for our function bodies.

extract_bytes() {
  local const_name="$1"
  # Match: pub const <name>: [u8; N] = [ ... ];
  # Returns the bytes between [ and ] on one or more lines
  python3 - "$VK_TMP" "$const_name" << 'PYEOF'
import sys, re

filepath   = sys.argv[1]
const_name = sys.argv[2]

with open(filepath) as f:
    content = f.read()

# Find the constant block
pattern = rf'pub\s+const\s+{re.escape(const_name)}\s*:\s*\[u8\s*;\s*\d+\]\s*=\s*(\[[\s\S]*?\]);'
m = re.search(pattern, content)
if not m:
    print(f"ERROR: {const_name} not found in VK file", file=sys.stderr)
    sys.exit(1)

# Extract and normalise the byte array
raw = m.group(1)
# Strip outer brackets, collapse whitespace
inner = re.sub(r'\s+', ' ', raw.strip()[1:-1].strip())
print(inner)
PYEOF
}

echo ""
echo "Extracting VK constants..."

ALPHA_G1_BYTES=$(extract_bytes "ALPHA_G1"   2>/dev/null || extract_bytes "VK_ALPHA_G1" 2>/dev/null || echo "")
BETA_G2_BYTES=$(extract_bytes "BETA_G2"    2>/dev/null || extract_bytes "VK_BETA_G2"  2>/dev/null || echo "")
GAMMA_G2_BYTES=$(extract_bytes "GAMMA_G2"   2>/dev/null || extract_bytes "VK_GAMMA_G2" 2>/dev/null || echo "")
DELTA_G2_BYTES=$(extract_bytes "DELTA_G2"   2>/dev/null || extract_bytes "VK_DELTA_G2" 2>/dev/null || echo "")
IC0_BYTES=$(extract_bytes "IC_0"       2>/dev/null || extract_bytes "VK_IC_0"   2>/dev/null || echo "")
IC1_BYTES=$(extract_bytes "IC_1"       2>/dev/null || extract_bytes "VK_IC_1"   2>/dev/null || echo "")
IC2_BYTES=$(extract_bytes "IC_2"       2>/dev/null || extract_bytes "VK_IC_2"   2>/dev/null || echo "")

# Validate all extracted
MISSING=0
for NAME in ALPHA_G1_BYTES BETA_G2_BYTES GAMMA_G2_BYTES DELTA_G2_BYTES IC0_BYTES IC1_BYTES IC2_BYTES; do
  VAL="${!NAME}"
  if [[ -z "$VAL" ]]; then
    echo "⚠ Could not extract $NAME — check VK file format at $VK_URL"
    MISSING=1
  fi
done

if [[ $MISSING -eq 1 ]]; then
  echo ""
  echo "The VK file format may have changed. Open $VK_TMP and manually copy"
  echo "the byte arrays into the vk_* functions in $LIB_RS."
  echo ""
  echo "Functions to fill:"
  echo "  fn vk_alpha_g1  → ALPHA_G1  (64 bytes)"
  echo "  fn vk_beta_g2   → BETA_G2   (128 bytes)"
  echo "  fn vk_gamma_g2  → GAMMA_G2  (128 bytes)"
  echo "  fn vk_delta_g2  → DELTA_G2  (128 bytes)"
  echo "  fn vk_ic0_g1    → IC_0      (64 bytes)"
  echo "  fn vk_ic1_g1    → IC_1      (64 bytes)"
  echo "  fn vk_ic2_g1    → IC_2      (64 bytes)"
  exit 1
fi

echo "✓ All 7 VK constants extracted"

# ── 3. Patch lib.rs ────────────────────────────────────────────────────────────
echo ""
echo "Patching $LIB_RS..."

# Back up first
cp "$LIB_RS" "${LIB_RS}.bak"

python3 - "$LIB_RS" \
  "$ALPHA_G1_BYTES" "$BETA_G2_BYTES" "$GAMMA_G2_BYTES" "$DELTA_G2_BYTES" \
  "$IC0_BYTES" "$IC1_BYTES" "$IC2_BYTES" << 'PYEOF'
import sys, re

lib_rs      = sys.argv[1]
alpha_g1    = sys.argv[2]
beta_g2     = sys.argv[3]
gamma_g2    = sys.argv[4]
delta_g2    = sys.argv[5]
ic0         = sys.argv[6]
ic1         = sys.argv[7]
ic2         = sys.argv[8]

with open(lib_rs) as f:
    content = f.read()

def replace_fn_body(src, fn_name, size, new_bytes):
    """Replace the body of a fn vk_*() function with the real byte array."""
    # Match: fn <fn_name>(env: &Env) -> BytesN<N> {\n    // ...\n    BytesN::from_array(env, &[0u8; N])\n}
    pattern = rf'(fn {re.escape(fn_name)}\(env: &Env\) -> BytesN<{size}> \{{)([\s\S]*?)(\}})'
    replacement = rf'\1\n    BytesN::from_array(env, &[{new_bytes}])\n\3'
    result, count = re.subn(pattern, replacement, src)
    if count == 0:
        print(f"WARNING: could not find fn {fn_name}", file=sys.stderr)
    return result

content = replace_fn_body(content, 'vk_alpha_g1', 64,  alpha_g1)
content = replace_fn_body(content, 'vk_beta_g2',  128, beta_g2)
content = replace_fn_body(content, 'vk_gamma_g2', 128, gamma_g2)
content = replace_fn_body(content, 'vk_delta_g2', 128, delta_g2)
content = replace_fn_body(content, 'vk_ic0_g1',   64,  ic0)
content = replace_fn_body(content, 'vk_ic1_g1',   64,  ic1)
content = replace_fn_body(content, 'vk_ic2_g1',   64,  ic2)

with open(lib_rs, 'w') as f:
    f.write(content)

print("✓ Patched successfully")
PYEOF

# ── 4. Verify no placeholder zeros remain ──────────────────────────────────────
if grep -q "BytesN::from_array(env, &\[0u8; " "$LIB_RS"; then
  echo "⚠  Some placeholder zero arrays still remain in $LIB_RS"
  echo "   Check the functions listed above and patch manually."
else
  echo "✓ No placeholder zeros found — all VK constants patched"
fi

echo ""
echo "=============================================="
echo "✅ VK constants patched into $LIB_RS"
echo ""
echo "Backup saved at: ${LIB_RS}.bak"
echo ""
echo "Next step:"
echo "  bash scripts/deploy-verifier.sh"
echo "=============================================="
