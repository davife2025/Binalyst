// our-contract/src/lib.rs — REWRITTEN (Session P2)
//
// Binalyst's own Soroban contract. This does NOT reimplement Groth16
// verification — that work is fully handled by NethermindEth's deployed
// Groth16Verifier, reached through their VerifierRouter.
//
// What this contract does:
//   1. Calls router.verify(seal, image_id, journal_digest) — panics on
//      invalid proof (the router's own behaviour; we don't catch errors
//      because an invalid proof should hard-fail the transaction).
//   2. On success, parses the journal (passed alongside seal so we can
//      record human-readable fields) and stores a compact ProofRecord.
//   3. Emits a TradeProofVerified event.
//   4. Exposes read helpers for the UI: proof_count, get_proof, get_recent_proofs.
//
// This is dramatically simpler than the old Session P contract because all
// cryptographic verification is delegated to NethermindEth's audited(-ish —
// see their SECURITY.md, "not yet audited") infrastructure rather than
// hand-rolled BN254 pairing logic.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, Map, String, Symbol, Vec,
    log, panic_with_error,
};
use risc0_interface::RiscZeroVerifierRouterClient;

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────
const KEY_ADMIN:       &str = "admin";
const KEY_ROUTER:      &str = "router";
const KEY_IMAGE_ID:    &str = "image_id";
const KEY_PROOF_LOG:   &str = "proof_log";
const KEY_PROOF_COUNT: &str = "proof_count";
const MAX_LOG_ENTRIES:  u32 = 500;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum RecorderError {
    Unauthorised      = 1,
    LogFull           = 2,
    InvalidJournal    = 3,
    ImageIdMismatch   = 4,
    NotInitialised    = 5,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ProofRecord {
    pub index:               u32,
    pub symbol:               String,
    pub action:               String,
    pub amount_usdt_cents:    i64,
    pub rule_id:              String,
    pub rule_name:            String,
    pub drawdown_bps:         i64,
    pub dry_run:              bool,
    pub decided_at_ms:        u64,
    pub verified_at_ledger:   u32,
    /// First 8 bytes of the journal_digest — compact fingerprint for the UI.
    pub journal_fingerprint:  BytesN<8>,
}

#[contract]
pub struct BinalystZkRecorder;

#[contractimpl]
impl BinalystZkRecorder {

    /// Deploy once. Wires up the admin, the NethermindEth router address,
    /// and the expected image_id (from `cargo risczero build` in zk-guest/).
    pub fn initialise(env: Env, admin: Address, router: Address, image_id: BytesN<32>) {
        if env.storage().instance().has(&Symbol::new(&env, KEY_ADMIN)) {
            panic_with_error!(&env, RecorderError::Unauthorised);
        }
        env.storage().instance().set(&Symbol::new(&env, KEY_ADMIN),       &admin);
        env.storage().instance().set(&Symbol::new(&env, KEY_ROUTER),      &router);
        env.storage().instance().set(&Symbol::new(&env, KEY_IMAGE_ID),    &image_id);
        env.storage().instance().set(&Symbol::new(&env, KEY_PROOF_COUNT), &0u32);
        env.storage().instance().set(
            &Symbol::new(&env, KEY_PROOF_LOG),
            &Map::<u32, ProofRecord>::new(&env),
        );
        env.events().publish((Symbol::new(&env, "Initialised"),), (admin, router));
    }

    /// Verify a trade proof and record it.
    ///
    /// Parameters:
    ///   seal            — Groth16 seal from binalyst-zk-host (encode_seal output)
    ///   journal_digest  — sha256(journal) from binalyst-zk-host
    ///   journal_json    — the raw journal bytes (JSON), used ONLY to extract
    ///                      human-readable fields for the audit log. The actual
    ///                      cryptographic check uses journal_digest, not this.
    ///
    /// Returns the on-chain proof index.
    pub fn verify_trade_proof(
        env:            Env,
        caller:         Address,
        seal:           Bytes,
        journal_digest: BytesN<32>,
        journal_json:   Bytes,
    ) -> u32 {
        caller.require_auth();

        let router_addr: Address = env.storage().instance()
            .get(&Symbol::new(&env, KEY_ROUTER))
            .unwrap_or_else(|| panic_with_error!(&env, RecorderError::NotInitialised));
        let image_id: BytesN<32> = env.storage().instance()
            .get(&Symbol::new(&env, KEY_IMAGE_ID))
            .unwrap_or_else(|| panic_with_error!(&env, RecorderError::NotInitialised));

        // ── Delegate verification entirely to NethermindEth's router ─────────
        // This call panics internally if the proof is invalid — we don't need
        // to (and shouldn't) catch that; an invalid proof must hard-fail.
        let router = RiscZeroVerifierRouterClient::new(&env, &router_addr);
        router.verify(&seal, &image_id, &journal_digest);

        // ── Proof is valid. Parse journal_json for the audit log. ────────────
        let record = parse_journal_and_build_record(&env, &journal_json, &journal_digest);

        // ── Persist ────────────────────────────────────────────────────────
        let count: u32 = env.storage().instance()
            .get(&Symbol::new(&env, KEY_PROOF_COUNT)).unwrap_or(0);
        if count >= MAX_LOG_ENTRIES {
            panic_with_error!(&env, RecorderError::LogFull);
        }
        let new_count = count + 1;

        let mut log_map: Map<u32, ProofRecord> = env.storage().instance()
            .get(&Symbol::new(&env, KEY_PROOF_LOG)).unwrap_or(Map::new(&env));

        let mut full_record = record;
        full_record.index             = new_count;
        full_record.verified_at_ledger = env.ledger().sequence();

        log_map.set(new_count, full_record.clone());
        env.storage().instance().set(&Symbol::new(&env, KEY_PROOF_LOG),   &log_map);
        env.storage().instance().set(&Symbol::new(&env, KEY_PROOF_COUNT), &new_count);

        env.events().publish(
            (Symbol::new(&env, "TradeProofVerified"),),
            (new_count, full_record.symbol.clone(), full_record.action.clone(),
             full_record.decided_at_ms, full_record.dry_run),
        );

        log!(&env, "Binalyst ZK: proof #{} verified via router — {} {}",
            new_count, full_record.action, full_record.symbol);

        new_count
    }

    pub fn proof_count(env: Env) -> u32 {
        env.storage().instance().get(&Symbol::new(&env, KEY_PROOF_COUNT)).unwrap_or(0)
    }

    pub fn get_proof(env: Env, index: u32) -> ProofRecord {
        let log_map: Map<u32, ProofRecord> = env.storage().instance()
            .get(&Symbol::new(&env, KEY_PROOF_LOG)).unwrap_or(Map::new(&env));
        log_map.get(index).unwrap()
    }

    pub fn get_recent_proofs(env: Env, n: u32) -> Vec<ProofRecord> {
        let count: u32 = env.storage().instance().get(&Symbol::new(&env, KEY_PROOF_COUNT)).unwrap_or(0);
        let log_map: Map<u32, ProofRecord> = env.storage().instance()
            .get(&Symbol::new(&env, KEY_PROOF_LOG)).unwrap_or(Map::new(&env));
        let mut results = Vec::new(&env);
        let start = if count > n { count - n + 1 } else { 1 };
        let mut i = count;
        while i >= start {
            if let Some(rec) = log_map.get(i) { results.push_back(rec); }
            if i == 0 { break; }
            i -= 1;
        }
        results
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, KEY_ADMIN)).unwrap()
    }

    pub fn router(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, KEY_ROUTER)).unwrap()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal no_std JSON field extractors (unchanged from prior session — these
// were correct; only the cryptographic verification logic was wrong before)
// ─────────────────────────────────────────────────────────────────────────────

fn parse_journal_and_build_record(env: &Env, journal_json: &Bytes, digest: &BytesN<32>) -> ProofRecord {
    let buf = journal_json.to_alloc_vec();

    let symbol        = json_str_field(&buf, b"\"symbol\"").unwrap_or(b"UNKNOWN");
    let action        = json_str_field(&buf, b"\"action\"").unwrap_or(b"UNKNOWN");
    let amount_f       = json_f64_field(&buf, b"\"amount_usdt\"").unwrap_or(0.0);
    let rule_id        = json_str_field(&buf, b"\"rule_id\"").unwrap_or(b"");
    let rule_name      = json_str_field(&buf, b"\"rule_name\"").unwrap_or(b"");
    let drawdown_f      = json_f64_field(&buf, b"\"drawdown_pct\"").unwrap_or(0.0);
    let dry_run        = json_bool(&buf, b"\"dry_run\"").unwrap_or(true);
    let decided_at_ms   = json_f64_field(&buf, b"\"decided_at_ms\"").unwrap_or(0.0) as u64;

    let mut fp = [0u8; 8];
    let digest_arr = digest.to_array();
    fp.copy_from_slice(&digest_arr[0..8]);

    ProofRecord {
        index:               0,
        symbol:              String::from_str(env, core::str::from_utf8(symbol).unwrap_or("?")),
        action:              String::from_str(env, core::str::from_utf8(action).unwrap_or("?")),
        amount_usdt_cents:   (amount_f * 100.0) as i64,
        rule_id:             String::from_str(env, core::str::from_utf8(rule_id).unwrap_or("")),
        rule_name:           String::from_str(env, core::str::from_utf8(rule_name).unwrap_or("")),
        drawdown_bps:        (drawdown_f * 100.0) as i64,
        dry_run,
        decided_at_ms,
        verified_at_ledger:  0,
        journal_fingerprint: BytesN::from_array(env, &fp),
    }
}

fn json_bool(buf: &[u8], key: &[u8]) -> Option<bool> {
    let pos  = find_subsequence(buf, key)? + key.len();
    let rest = buf.get(pos..)?;
    let colon = find_subsequence(rest, b":")?;
    let v = skip_whitespace(rest, colon + 1);
    if rest.get(v..)?.starts_with(b"true")  { return Some(true)  }
    if rest.get(v..)?.starts_with(b"false") { return Some(false) }
    None
}

fn json_str_field<'a>(buf: &'a [u8], key: &[u8]) -> Option<&'a [u8]> {
    let pos  = find_subsequence(buf, key)? + key.len();
    let rest = buf.get(pos..)?;
    let colon = find_subsequence(rest, b":")?;
    let after = skip_whitespace(rest, colon + 1);
    if rest.get(after)? != &b'"' { return None; }
    let start = after + 1;
    let end   = find_byte(rest.get(start..)?, b'"')? + start;
    rest.get(start..end)
}

fn json_f64_field(buf: &[u8], key: &[u8]) -> Option<f64> {
    let pos  = find_subsequence(buf, key)? + key.len();
    let rest = buf.get(pos..)?;
    let colon = find_subsequence(rest, b":")?;
    let start = skip_whitespace(rest, colon + 1);
    let end = rest.get(start..)?.iter()
        .position(|&b| b == b',' || b == b'}' || b == b'\n')
        .map(|p| p + start).unwrap_or(rest.len());
    let s = core::str::from_utf8(rest.get(start..end)?.trim_ascii()).ok()?;
    s.parse::<f64>().ok()
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}
fn find_byte(haystack: &[u8], byte: u8) -> Option<usize> {
    haystack.iter().position(|&b| b == byte)
}
fn skip_whitespace(buf: &[u8], start: usize) -> usize {
    let mut i = start;
    while i < buf.len() && matches!(buf[i], b' ' | b'\t' | b'\n' | b'\r') { i += 1; }
    i
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_extractors() {
        let buf = br#"{"symbol":"BTC","action":"BUY","amount_usdt":1000.5,"dry_run":true}"#;
        assert_eq!(json_str_field(buf, b"\"symbol\""), Some(b"BTC".as_ref()));
        assert_eq!(json_str_field(buf, b"\"action\""), Some(b"BUY".as_ref()));
        assert!((json_f64_field(buf, b"\"amount_usdt\"").unwrap() - 1000.5).abs() < 0.01);
        assert_eq!(json_bool(buf, b"\"dry_run\""), Some(true));
    }
}
