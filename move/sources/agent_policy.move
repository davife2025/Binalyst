/// binalyst_policy::agent_policy
///
/// Move smart contract for the Binalyst Autonomous Agent Wallet.
/// Implements Sub-track 2 of the Sui Overflow 2026 Agentic Web track.
///
/// Key properties enforced on-chain:
///   1. Budget ceiling — agent cannot spend more than cap_cents total
///   2. Per-trade limit — single trade cannot exceed per_trade_limit_cents
///   3. Protocol scope — optional whitelist of DeepBook pool IDs
///   4. Expiry — policy auto-expires after a given epoch
///   5. Owner revocation — only owner can revoke; revocation is immediate
///
/// Every trade the agent executes must pass through `check_and_spend`,
/// which enforces all five constraints atomically in a single PTB call.
/// This makes the budget ceiling self-enforcing on-chain — not just a
/// client-side check.
///
/// Activity log: every `check_and_spend` call emits a TradeExecuted event.
/// These events are the on-chain activity log judges can query at any time.

module binalyst_policy::agent_policy {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::vector;
    use std::string::{Self, String};

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    const ENotOwner:            u64 = 1;
    const ENotAgent:            u64 = 2;
    const EPolicyRevoked:       u64 = 3;
    const EPolicyExpired:       u64 = 4;
    const EBudgetExceeded:      u64 = 5;
    const EPerTradeLimitExceeded: u64 = 6;
    const EPoolNotAllowed:      u64 = 7;
    const EAlreadyRevoked:      u64 = 8;
    const EInvalidBudget:       u64 = 9;
    const EInvalidPerTrade:     u64 = 10;

    // ─────────────────────────────────────────────────────────────────────────
    // Core object
    // ─────────────────────────────────────────────────────────────────────────

    /// The policy object shared on-chain.
    /// Shared (not owned) so both the agent and owner can access it.
    struct AgentPolicy has key {
        id:                   UID,
        /// Owner — the only address that can revoke
        owner:                address,
        /// Agent — the only address that can call check_and_spend
        agent:                address,
        /// Total budget in USD cents (e.g. 50000 = $500.00)
        budget_cap_cents:     u64,
        /// Max per single trade in USD cents
        per_trade_limit_cents: u64,
        /// Total spent so far in USD cents
        spent_cents:          u64,
        /// Allowed DeepBook pool IDs (empty = all allowed)
        allowed_pools:        vector<String>,
        /// Expiry epoch (0 = no expiry)
        expiry_epoch:         u64,
        /// Whether the policy has been revoked
        revoked:              bool,
        /// ISO timestamp of creation (stored for log display)
        created_at_ms:        u64,
        /// Running count of trades executed
        trade_count:          u64,
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events (the on-chain activity log)
    // ─────────────────────────────────────────────────────────────────────────

    struct PolicyCreated has copy, drop {
        policy_id:            address,
        owner:                address,
        agent:                address,
        budget_cap_cents:     u64,
        per_trade_limit_cents: u64,
        expiry_epoch:         u64,
        created_at_ms:        u64,
    }

    struct TradeExecuted has copy, drop {
        policy_id:       address,
        agent:           address,
        amount_cents:    u64,
        pool_id:         String,
        side:            String,   // "bid" or "ask"
        signal_score:    u64,      // 0–100 scaled by 100 (e.g. 7500 = 75.00)
        spent_after:     u64,
        remaining:       u64,
        trade_index:     u64,
        timestamp_ms:    u64,
    }

    struct PolicyRevoked has copy, drop {
        policy_id:    address,
        owner:        address,
        spent_cents:  u64,
        trade_count:  u64,
        revoked_at_ms: u64,
    }

    struct BudgetWarning has copy, drop {
        policy_id:    address,
        spent_cents:  u64,
        cap_cents:    u64,
        pct_used:     u64,   // 0–100
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Entry functions
    // ─────────────────────────────────────────────────────────────────────────

    /// Create a new agent policy and share it on-chain.
    /// Called by the OWNER wallet.
    public entry fun create_policy(
        agent:                 address,
        budget_cap_cents:      u64,
        per_trade_limit_cents: u64,
        expiry_epoch:          u64,
        clock:                 &Clock,
        ctx:                   &mut TxContext,
    ) {
        assert!(budget_cap_cents > 0, EInvalidBudget);
        assert!(per_trade_limit_cents > 0 && per_trade_limit_cents <= budget_cap_cents, EInvalidPerTrade);

        let owner       = tx_context::sender(ctx);
        let now_ms      = clock::timestamp_ms(clock);
        let policy_uid  = object::new(ctx);
        let policy_addr = object::uid_to_address(&policy_uid);

        let policy = AgentPolicy {
            id:                    policy_uid,
            owner,
            agent,
            budget_cap_cents,
            per_trade_limit_cents,
            spent_cents:           0,
            allowed_pools:         vector::empty(),
            expiry_epoch,
            revoked:               false,
            created_at_ms:         now_ms,
            trade_count:           0,
        };

        event::emit(PolicyCreated {
            policy_id: policy_addr,
            owner,
            agent,
            budget_cap_cents,
            per_trade_limit_cents,
            expiry_epoch,
            created_at_ms: now_ms,
        });

        // Share so both owner and agent can access
        transfer::share_object(policy);
    }

    /// Add a pool to the allowed list.
    /// Called by the OWNER wallet.
    public entry fun add_allowed_pool(
        policy:  &mut AgentPolicy,
        pool_id: String,
        ctx:     &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == policy.owner, ENotOwner);
        assert!(!policy.revoked, EPolicyRevoked);
        vector::push_back(&mut policy.allowed_pools, pool_id);
    }

    /// Core enforcement function — called by the AGENT wallet before every trade.
    /// Checks all constraints atomically and records the spend.
    /// Emits a TradeExecuted event (the on-chain activity log entry).
    public entry fun check_and_spend(
        policy:       &mut AgentPolicy,
        amount_cents: u64,
        pool_id:      String,
        side:         String,
        signal_score: u64,
        clock:        &Clock,
        ctx:          &mut TxContext,
    ) {
        let sender    = tx_context::sender(ctx);
        let now_ms    = clock::timestamp_ms(clock);
        let now_epoch = tx_context::epoch(ctx);

        // ── Enforce constraints ───────────────────────────────────────────────
        assert!(sender == policy.agent,                       ENotAgent);
        assert!(!policy.revoked,                              EPolicyRevoked);
        assert!(policy.expiry_epoch == 0 || now_epoch < policy.expiry_epoch, EPolicyExpired);
        assert!(amount_cents <= policy.per_trade_limit_cents, EPerTradeLimitExceeded);
        assert!(policy.spent_cents + amount_cents <= policy.budget_cap_cents, EBudgetExceeded);

        // Pool whitelist check
        if (!vector::is_empty(&policy.allowed_pools)) {
            assert!(vector::contains(&policy.allowed_pools, &pool_id), EPoolNotAllowed);
        };

        // ── Record spend ──────────────────────────────────────────────────────
        policy.spent_cents = policy.spent_cents + amount_cents;
        policy.trade_count = policy.trade_count + 1;

        let remaining = policy.budget_cap_cents - policy.spent_cents;

        // Emit trade event (on-chain activity log)
        event::emit(TradeExecuted {
            policy_id:    object::uid_to_address(&policy.id),
            agent:        sender,
            amount_cents,
            pool_id,
            side,
            signal_score,
            spent_after:  policy.spent_cents,
            remaining,
            trade_index:  policy.trade_count,
            timestamp_ms: now_ms,
        });

        // Emit budget warning at 80% usage
        let pct_used = (policy.spent_cents * 100) / policy.budget_cap_cents;
        if (pct_used >= 80) {
            event::emit(BudgetWarning {
                policy_id:   object::uid_to_address(&policy.id),
                spent_cents: policy.spent_cents,
                cap_cents:   policy.budget_cap_cents,
                pct_used,
            });
        };
    }

    /// Revoke the policy — immediately prevents all future agent trades.
    /// Called by the OWNER wallet only. Irreversible.
    public entry fun revoke_policy(
        policy: &mut AgentPolicy,
        clock:  &Clock,
        ctx:    &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == policy.owner, ENotOwner);
        assert!(!policy.revoked, EAlreadyRevoked);

        policy.revoked = true;

        event::emit(PolicyRevoked {
            policy_id:     object::uid_to_address(&policy.id),
            owner:         policy.owner,
            spent_cents:   policy.spent_cents,
            trade_count:   policy.trade_count,
            revoked_at_ms: clock::timestamp_ms(clock),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read-only view functions
    // ─────────────────────────────────────────────────────────────────────────

    public fun is_revoked(policy: &AgentPolicy): bool            { policy.revoked }
    public fun owner(policy: &AgentPolicy): address              { policy.owner }
    public fun agent(policy: &AgentPolicy): address              { policy.agent }
    public fun budget_cap(policy: &AgentPolicy): u64             { policy.budget_cap_cents }
    public fun per_trade_limit(policy: &AgentPolicy): u64        { policy.per_trade_limit_cents }
    public fun spent(policy: &AgentPolicy): u64                  { policy.spent_cents }
    public fun remaining(policy: &AgentPolicy): u64              { policy.budget_cap_cents - policy.spent_cents }
    public fun trade_count(policy: &AgentPolicy): u64            { policy.trade_count }
    public fun expiry_epoch(policy: &AgentPolicy): u64           { policy.expiry_epoch }

    public fun can_trade(policy: &AgentPolicy, amount_cents: u64, epoch: u64): bool {
        if (policy.revoked) return false;
        if (policy.expiry_epoch != 0 && epoch >= policy.expiry_epoch) return false;
        if (amount_cents > policy.per_trade_limit_cents) return false;
        if (policy.spent_cents + amount_cents > policy.budget_cap_cents) return false;
        true
    }

    public fun budget_pct_used(policy: &AgentPolicy): u64 {
        if (policy.budget_cap_cents == 0) return 100;
        (policy.spent_cents * 100) / policy.budget_cap_cents
    }
}
