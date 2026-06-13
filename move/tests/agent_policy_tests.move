/// Tests for binalyst_policy::agent_policy
///
/// Run with: sui move test
/// All tests use the Move test framework (no external deps).

#[test_only]
module binalyst_policy::agent_policy_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self, Clock};
    use binalyst_policy::agent_policy::{Self, AgentPolicy};
    use std::string;

    // Test addresses
    const OWNER: address = @0xABCD;
    const AGENT: address = @0x1234;
    const OTHER: address = @0x9999;

    const BUDGET_CENTS:    u64 = 50_000;  // $500
    const PER_TRADE_CENTS: u64 = 5_000;   // $50
    const NO_EXPIRY:       u64 = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: create a standard policy
    // ─────────────────────────────────────────────────────────────────────────

    fun setup_policy(scenario: &mut Scenario) {
        ts::next_tx(scenario, OWNER);
        {
            let clock = clock::create_for_testing(ts::ctx(scenario));
            agent_policy::create_policy(
                AGENT,
                BUDGET_CENTS,
                PER_TRADE_CENTS,
                NO_EXPIRY,
                &clock,
                ts::ctx(scenario),
            );
            clock::destroy_for_testing(clock);
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: policy created with correct fields
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fun test_create_policy() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            assert!(agent_policy::owner(&policy)          == OWNER,          0);
            assert!(agent_policy::agent(&policy)          == AGENT,          1);
            assert!(agent_policy::budget_cap(&policy)     == BUDGET_CENTS,   2);
            assert!(agent_policy::per_trade_limit(&policy)== PER_TRADE_CENTS,3);
            assert!(agent_policy::spent(&policy)          == 0,              4);
            assert!(agent_policy::trade_count(&policy)    == 0,              5);
            assert!(!agent_policy::is_revoked(&policy),                      6);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: agent can spend within limits
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fun test_check_and_spend_success() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, AGENT);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));

            agent_policy::check_and_spend(
                &mut policy,
                3_000,                          // $30 — within $50 limit
                string::utf8(b"SUI/USDC-pool"),
                string::utf8(b"bid"),
                7_500,                          // signal score 75.00
                &clock,
                ts::ctx(&mut scenario),
            );

            assert!(agent_policy::spent(&policy)      == 3_000,              0);
            assert!(agent_policy::remaining(&policy)  == 47_000,             1);
            assert!(agent_policy::trade_count(&policy)== 1,                  2);

            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: per-trade limit enforced
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    #[expected_failure(abort_code = binalyst_policy::agent_policy::EPerTradeLimitExceeded)]
    fun test_per_trade_limit_exceeded() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, AGENT);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));

            agent_policy::check_and_spend(
                &mut policy,
                6_000,                          // $60 — exceeds $50 per-trade limit
                string::utf8(b"SUI/USDC-pool"),
                string::utf8(b"bid"),
                8_000,
                &clock,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: budget cap enforced
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    #[expected_failure(abort_code = binalyst_policy::agent_policy::EBudgetExceeded)]
    fun test_budget_cap_exceeded() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        // Spend nearly all the budget
        ts::next_tx(&mut scenario, AGENT);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            // 10 × $49 = $490 spent
            let i = 0u64;
            while (i < 10) {
                agent_policy::check_and_spend(
                    &mut policy, 4_900,
                    string::utf8(b"pool"), string::utf8(b"bid"), 7000,
                    &clock, ts::ctx(&mut scenario),
                );
                i = i + 1;
            };
            // This $50 should push us over $500
            agent_policy::check_and_spend(
                &mut policy, 5_000,
                string::utf8(b"pool"), string::utf8(b"bid"), 7000,
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: non-agent cannot spend
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    #[expected_failure(abort_code = binalyst_policy::agent_policy::ENotAgent)]
    fun test_only_agent_can_spend() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, OTHER);   // NOT the agent
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::check_and_spend(
                &mut policy, 1_000,
                string::utf8(b"pool"), string::utf8(b"bid"), 5000,
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: owner revocation prevents further trades
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fun test_revocation_flow() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        // Agent makes a trade
        ts::next_tx(&mut scenario, AGENT);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::check_and_spend(
                &mut policy, 2_000,
                string::utf8(b"pool"), string::utf8(b"bid"), 6000,
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        // Owner revokes
        ts::next_tx(&mut scenario, OWNER);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::revoke_policy(&mut policy, &clock, ts::ctx(&mut scenario));
            assert!(agent_policy::is_revoked(&policy), 0);
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: agent cannot trade after revocation
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    #[expected_failure(abort_code = binalyst_policy::agent_policy::EPolicyRevoked)]
    fun test_trade_after_revocation_fails() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        // Revoke immediately
        ts::next_tx(&mut scenario, OWNER);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::revoke_policy(&mut policy, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        // Agent tries to trade — should fail
        ts::next_tx(&mut scenario, AGENT);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::check_and_spend(
                &mut policy, 1_000,
                string::utf8(b"pool"), string::utf8(b"bid"), 5000,
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: only owner can revoke
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    #[expected_failure(abort_code = binalyst_policy::agent_policy::ENotOwner)]
    fun test_only_owner_can_revoke() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, OTHER);   // NOT the owner
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            let clock  = clock::create_for_testing(ts::ctx(&mut scenario));
            agent_policy::revoke_policy(&mut policy, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test: can_trade view function
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fun test_can_trade_view() {
        let scenario = ts::begin(OWNER);
        setup_policy(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let policy = ts::take_shared<AgentPolicy>(&scenario);
            assert!( agent_policy::can_trade(&policy, 5_000, 0), 0);  // within limits
            assert!(!agent_policy::can_trade(&policy, 6_000, 0), 1);  // over per-trade
            assert!( agent_policy::can_trade(&policy, 1_000, 0), 2);  // well within
            ts::return_shared(policy);
        };

        ts::end(scenario);
    }
}
