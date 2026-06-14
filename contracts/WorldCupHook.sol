// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * WorldCupHook.sol
 * Session 2 — Binalyst X Layer World Cup Hooks Competition
 *
 * A Uniswap V4 Hook that dynamically adjusts swap fees based on
 * live World Cup match state. Fee tiers:
 *
 *   PRE_MATCH   → 0.05%  (500 bips)
 *   MATCH_LIVE  → 0.30%  (3000 bips)
 *   GOAL_SCORED → 0.80%  (8000 bips)  ← volatility spike
 *   POST_MATCH  → 0.10%  (1000 bips)
 *
 * Deployment: X Layer (chainId 196) via eulr.fun launchpad (Method 2)
 * or Uniswap allowlist portal (Method 1).
 *
 * SAFE: This is a new file in a new contracts/ folder.
 * Nothing in the existing BNB/BSC build references or imports this.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap V4 interfaces (inline — no external imports needed for deployment)
// ─────────────────────────────────────────────────────────────────────────────

interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24  fee;
        int24   tickSpacing;
        address hooks;
    }

    function updateDynamicSwapFee(PoolKey calldata key, uint24 newDynamicSwapFee) external;
}

interface IHooks {
    function getHookPermissions() external pure returns (Hooks.Permissions memory);
}

library Hooks {
    struct Permissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeAddLiquidity;
        bool afterAddLiquidity;
        bool beforeRemoveLiquidity;
        bool afterRemoveLiquidity;
        bool beforeSwap;
        bool afterSwap;
        bool beforeDonate;
        bool afterDonate;
        bool beforeSwapReturnDelta;
        bool afterSwapReturnDelta;
        bool afterAddLiquidityReturnDelta;
        bool afterRemoveLiquidityReturnDelta;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WorldCupHook
// ─────────────────────────────────────────────────────────────────────────────

contract WorldCupHook {

    // ── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error NotOracle();
    error InvalidMatchId();
    error MatchAlreadyFinished();
    error InvalidFeeState();
    error ZeroAddress();

    // ── Events ───────────────────────────────────────────────────────────────
    event MatchStateUpdated(uint256 indexed matchId, MatchState newState, uint24 fee);
    event GoalScored(uint256 indexed matchId, string scoringTeam);
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 kickoff);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Fee constants (bips — Uniswap V4 uses 1/1_000_000 units) ────────────
    // Uniswap V4 fee is expressed in pips (hundredths of a bip)
    // 500   = 0.05%
    // 3000  = 0.30%
    // 8000  = 0.80%
    // 1000  = 0.10%
    uint24 public constant FEE_PRE_MATCH   = 500;
    uint24 public constant FEE_MATCH_LIVE  = 3000;
    uint24 public constant FEE_GOAL_SCORED = 8000;
    uint24 public constant FEE_POST_MATCH  = 1000;

    // ── Match state enum ─────────────────────────────────────────────────────
    enum MatchState {
        NOT_STARTED,   // 0 — before kick-off window
        PRE_MATCH,     // 1 — within 1h of kick-off, low fee
        LIVE,          // 2 — match in progress
        GOAL,          // 3 — goal just scored (brief spike)
        POST_MATCH,    // 4 — match ended
        CANCELLED      // 5 — cancelled/postponed
    }

    // ── Match record ─────────────────────────────────────────────────────────
    struct Match {
        string    teamA;
        string    teamB;
        uint256   kickoffTime;     // Unix timestamp
        uint256   endTime;         // Unix timestamp
        MatchState state;
        uint8     goalsA;
        uint8     goalsB;
        bool      exists;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    address public owner;
    address public oracle;           // trusted address that pushes match updates
    IPoolManager public poolManager;

    // Active match driving the current fee — 0 if none
    uint256 public activeMatchId;

    // Current fee applied to the pool
    uint24 public currentFee;

    // Match registry
    mapping(uint256 => Match) public matches;
    uint256 public matchCount;

    // Pool key this hook is attached to (set on first initialize)
    IPoolManager.PoolKey internal _poolKey;
    bool internal _poolKeySet;

    // Goal state — auto-resets to LIVE after GOAL_DURATION
    uint256 public constant GOAL_DURATION = 120;  // 2 minutes
    uint256 public goalTimestamp;

    // Pre-match window — fee drops 1h before kick-off
    uint256 public constant PRE_MATCH_WINDOW = 3600; // 1 hour

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _poolManager, address _oracle) {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_oracle      == address(0)) revert ZeroAddress();
        owner       = msg.sender;
        oracle      = _oracle;
        poolManager = IPoolManager(_poolManager);
        currentFee  = FEE_PRE_MATCH;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle && msg.sender != owner) revert NotOracle();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hook permissions — we only need beforeSwap to inject dynamic fee
    // ─────────────────────────────────────────────────────────────────────────

    function getHookPermissions() external pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize:              false,
            afterInitialize:               true,   // capture pool key
            beforeAddLiquidity:            false,
            afterAddLiquidity:             false,
            beforeRemoveLiquidity:         false,
            afterRemoveLiquidity:          false,
            beforeSwap:                    true,   // inject dynamic fee
            afterSwap:                     false,
            beforeDonate:                  false,
            afterDonate:                   false,
            beforeSwapReturnDelta:         false,
            afterSwapReturnDelta:          false,
            afterAddLiquidityReturnDelta:  false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // afterInitialize — store pool key for later fee updates
    // ─────────────────────────────────────────────────────────────────────────

    function afterInitialize(
        address,
        IPoolManager.PoolKey calldata key,
        uint160,
        int24,
        bytes calldata
    ) external returns (bytes4) {
        if (!_poolKeySet) {
            _poolKey    = key;
            _poolKeySet = true;
        }
        return this.afterInitialize.selector;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // beforeSwap — evaluate match state, update fee if changed
    // ─────────────────────────────────────────────────────────────────────────

    function beforeSwap(
        address,
        IPoolManager.PoolKey calldata key,
        bool,       // zeroForOne
        int256,     // amountSpecified
        bytes calldata
    ) external returns (bytes4, int128, uint24) {
        uint24 fee = _computeCurrentFee();

        // Only push an update to PoolManager if fee has changed — saves gas
        if (fee != currentFee) {
            currentFee = fee;
            if (_poolKeySet) {
                poolManager.updateDynamicSwapFee(key, fee);
            }
            emit MatchStateUpdated(activeMatchId, _getActiveMatchState(), fee);
        }

        // Return: selector, hook delta (0 = no delta), override fee
        return (this.beforeSwap.selector, 0, fee);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle interface — match lifecycle management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Register a new match. Called before the tournament by owner/oracle.
     */
    function createMatch(
        string calldata teamA,
        string calldata teamB,
        uint256         kickoffTime
    ) external onlyOracle returns (uint256 matchId) {
        matchId = ++matchCount;
        matches[matchId] = Match({
            teamA:       teamA,
            teamB:       teamB,
            kickoffTime: kickoffTime,
            endTime:     0,
            state:       MatchState.NOT_STARTED,
            goalsA:      0,
            goalsB:      0,
            exists:      true
        });
        emit MatchCreated(matchId, teamA, teamB, kickoffTime);
    }

    /**
     * Set the active match — the one whose state drives the pool fee.
     */
    function setActiveMatch(uint256 matchId) external onlyOracle {
        if (!matches[matchId].exists) revert InvalidMatchId();
        activeMatchId = matchId;
    }

    /**
     * Push match state update from oracle.
     */
    function updateMatchState(uint256 matchId, MatchState newState) external onlyOracle {
        if (!matches[matchId].exists)           revert InvalidMatchId();
        if (matches[matchId].state == MatchState.POST_MATCH ||
            matches[matchId].state == MatchState.CANCELLED)  revert MatchAlreadyFinished();

        matches[matchId].state = newState;

        if (newState == MatchState.POST_MATCH) {
            matches[matchId].endTime = block.timestamp;
        }

        uint24 fee = _computeCurrentFee();
        currentFee = fee;

        if (_poolKeySet) {
            poolManager.updateDynamicSwapFee(_poolKey, fee);
        }

        emit MatchStateUpdated(matchId, newState, fee);
    }

    /**
     * Record a goal — spikes fee for GOAL_DURATION seconds.
     */
    function recordGoal(uint256 matchId, string calldata scoringTeam, bool isTeamA) external onlyOracle {
        if (!matches[matchId].exists)                     revert InvalidMatchId();
        if (matches[matchId].state != MatchState.LIVE)    revert InvalidFeeState();

        if (isTeamA) {
            matches[matchId].goalsA++;
        } else {
            matches[matchId].goalsB++;
        }

        matches[matchId].state = MatchState.GOAL;
        goalTimestamp          = block.timestamp;

        currentFee = FEE_GOAL_SCORED;

        if (_poolKeySet) {
            poolManager.updateDynamicSwapFee(_poolKey, FEE_GOAL_SCORED);
        }

        emit GoalScored(matchId, scoringTeam);
        emit MatchStateUpdated(matchId, MatchState.GOAL, FEE_GOAL_SCORED);
    }

    /**
     * Resolve goal spike back to LIVE — can be called by anyone after GOAL_DURATION.
     * Gasless: designed to be called by a keeper or any user.
     */
    function resolveGoalSpike(uint256 matchId) external {
        if (!matches[matchId].exists)                      revert InvalidMatchId();
        if (matches[matchId].state != MatchState.GOAL)     revert InvalidFeeState();
        if (block.timestamp < goalTimestamp + GOAL_DURATION) revert InvalidFeeState();

        matches[matchId].state = MatchState.LIVE;
        currentFee             = FEE_MATCH_LIVE;

        if (_poolKeySet) {
            poolManager.updateDynamicSwapFee(_poolKey, FEE_MATCH_LIVE);
        }

        emit MatchStateUpdated(matchId, MatchState.LIVE, FEE_MATCH_LIVE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal fee computation
    // ─────────────────────────────────────────────────────────────────────────

    function _computeCurrentFee() internal view returns (uint24) {
        if (activeMatchId == 0 || !matches[activeMatchId].exists) {
            return FEE_PRE_MATCH;
        }

        Match storage m = matches[activeMatchId];

        // Auto-detect pre-match window from kickoff time
        if (m.state == MatchState.NOT_STARTED) {
            if (block.timestamp >= m.kickoffTime - PRE_MATCH_WINDOW &&
                block.timestamp <  m.kickoffTime) {
                return FEE_PRE_MATCH;
            }
            return FEE_PRE_MATCH; // default before window
        }

        if (m.state == MatchState.PRE_MATCH)  return FEE_PRE_MATCH;
        if (m.state == MatchState.LIVE)       return FEE_MATCH_LIVE;
        if (m.state == MatchState.GOAL) {
            // Auto-resolve if duration passed
            if (block.timestamp >= goalTimestamp + GOAL_DURATION) return FEE_MATCH_LIVE;
            return FEE_GOAL_SCORED;
        }
        if (m.state == MatchState.POST_MATCH) return FEE_POST_MATCH;

        return FEE_PRE_MATCH; // CANCELLED / default
    }

    function _getActiveMatchState() internal view returns (MatchState) {
        if (activeMatchId == 0 || !matches[activeMatchId].exists) return MatchState.NOT_STARTED;
        return matches[activeMatchId].state;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns a human-readable fee state label — used by the Binalyst UI.
     */
    function getFeeStateLabel() external view returns (string memory) {
        uint24 fee = _computeCurrentFee();
        if (fee == FEE_GOAL_SCORED) return "GOAL";
        if (fee == FEE_MATCH_LIVE)  return "LIVE";
        if (fee == FEE_POST_MATCH)  return "POST_MATCH";
        return "PRE_MATCH";
    }

    /**
     * Current fee as a percentage string — used by the Binalyst UI.
     */
    function getCurrentFeePct() external view returns (uint24 bips, string memory label) {
        bips  = _computeCurrentFee();
        label = this.getFeeStateLabel();
    }

    /**
     * Match details — used by the Binalyst World Cup tab.
     */
    function getMatch(uint256 matchId) external view returns (
        string  memory teamA,
        string  memory teamB,
        uint256        kickoffTime,
        uint256        endTime,
        uint8          state,
        uint8          goalsA,
        uint8          goalsB
    ) {
        Match storage m = matches[matchId];
        if (!m.exists) revert InvalidMatchId();
        return (m.teamA, m.teamB, m.kickoffTime, m.endTime, uint8(m.state), m.goalsA, m.goalsB);
    }

    /**
     * Active match summary — single call for the Binalyst dashboard.
     */
    function getActiveSummary() external view returns (
        uint256 matchId,
        string  memory teamA,
        string  memory teamB,
        uint8   state,
        uint24  fee,
        uint8   goalsA,
        uint8   goalsB
    ) {
        matchId = activeMatchId;
        if (matchId == 0 || !matches[matchId].exists) {
            return (0, "", "", 0, currentFee, 0, 0);
        }
        Match storage m = matches[matchId];
        return (matchId, m.teamA, m.teamB, uint8(m.state), _computeCurrentFee(), m.goalsA, m.goalsB);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * Emergency fee override — owner can manually set fee bypassing match state.
     * Used if oracle goes down during a match.
     */
    function emergencySetFee(uint24 fee) external onlyOwner {
        require(fee <= 10000, "Fee exceeds 1%");
        currentFee = fee;
        if (_poolKeySet) {
            poolManager.updateDynamicSwapFee(_poolKey, fee);
        }
    }
}
