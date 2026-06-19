// zk-host/build.rs
//
// Runs at compile time to embed the guest ELF binary into the host.
// risc0-build scans the workspace for guest crates and generates
// a methods.rs file containing BINALYST_ZK_GUEST_ELF + BINALYST_ZK_GUEST_ID.

fn main() {
    risc0_build::embed_methods();
}
