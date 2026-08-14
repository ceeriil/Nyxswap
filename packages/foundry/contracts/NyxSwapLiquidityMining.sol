// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "./interfaces/IERC20.sol";
import { NyxToken } from "./token/NyxToken.sol";

/// @title NyxSwap Liquidity Mining
/// @notice Time-weighted NYX rewards for staking NyxSwapPool LP shares. Standard
/// MasterChef accumulator design (accNyxPerShare, scaled 1e12) — the same
/// battle-tested pattern SushiSwap and countless forks use, not a new algorithm: it
/// correctly handles stakes/withdrawals landing at arbitrary times without needing to
/// checkpoint every staker on every block.
/// @dev NYX is minted on accrual, not pre-funded — updatePool() mints exactly the
/// reward that elapsed since its last update into this contract's own balance, which is
/// what deposit()/withdraw() then pay out of. Total NYX supply grows exactly in lockstep
/// with what's actually owed; there's no separate reward budget to run dry or overfund.
contract NyxSwapLiquidityMining {
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardTime;
        uint256 accNyxPerShare; // scaled by ACC_PRECISION
        uint256 totalStaked;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    uint256 private constant ACC_PRECISION = 1e12;

    NyxToken public immutable nyxToken;
    uint256 public immutable nyxPerSecond;
    uint256 public immutable startTime;

    address public owner;
    uint256 public totalAllocPoint;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => bool) public poolExistsFor;

    event PoolAdded(uint256 indexed pid, address indexed lpToken, uint256 allocPoint);
    event AllocPointSet(uint256 indexed pid, uint256 allocPoint);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed pid, uint256 amount);
    event OwnerTransferred(address indexed previous, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "NyxSwap: caller not owner");
        _;
    }

    constructor(address _owner, NyxToken _nyxToken, uint256 _nyxPerSecond, uint256 _startTime) {
        require(_owner != address(0), "NyxSwap: owner zero");
        require(address(_nyxToken) != address(0), "NyxSwap: token zero");
        owner = _owner;
        nyxToken = _nyxToken;
        nyxPerSecond = _nyxPerSecond;
        startTime = _startTime;
        emit OwnerTransferred(address(0), _owner);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /// @notice Settles every pool's accrual up to now. Required before totalAllocPoint
    /// changes (addPool, setAllocPoint) — otherwise a pool that isn't touched directly
    /// would blend its entire un-updated time window against the NEW totalAllocPoint on
    /// its next accrual, retroactively misattributing rewards across the point where the
    /// split changed. Bounded by poolInfo.length, which only grows via the same onlyOwner
    /// addPool() this guards, so this can't be grown into a gas-bomb by an attacker.
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 i = 0; i < length; i++) {
            updatePool(i);
        }
    }

    /// @notice Registers `lpToken` as a stakeable pool with `allocPoint` share of the
    /// total emission rate. One entry per LP token — reverts on a duplicate.
    function addPool(IERC20 lpToken, uint256 allocPoint) external onlyOwner {
        require(address(lpToken) != address(0), "NyxSwap: lpToken zero");
        require(!poolExistsFor[address(lpToken)], "NyxSwap: pool exists");
        massUpdatePools();

        poolExistsFor[address(lpToken)] = true;
        totalAllocPoint += allocPoint;
        poolInfo.push(
            PoolInfo({
                lpToken: lpToken,
                allocPoint: allocPoint,
                lastRewardTime: block.timestamp > startTime ? block.timestamp : startTime,
                accNyxPerShare: 0,
                totalStaked: 0
            })
        );
        emit PoolAdded(poolInfo.length - 1, address(lpToken), allocPoint);
    }

    function setAllocPoint(uint256 pid, uint256 allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint - poolInfo[pid].allocPoint + allocPoint;
        poolInfo[pid].allocPoint = allocPoint;
        emit AllocPointSet(pid, allocPoint);
    }

    /// @notice View-only preview of a user's currently-claimable NYX for `pid`,
    /// without needing to actually call updatePool() first.
    function pendingNyx(uint256 pid, address user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage u = userInfo[pid][user];

        uint256 accNyxPerShare = pool.accNyxPerShare;
        if (block.timestamp > pool.lastRewardTime && pool.totalStaked != 0 && totalAllocPoint != 0) {
            uint256 elapsed = block.timestamp - pool.lastRewardTime;
            uint256 reward = (elapsed * nyxPerSecond * pool.allocPoint) / totalAllocPoint;
            accNyxPerShare += (reward * ACC_PRECISION) / pool.totalStaked;
        }
        return (u.amount * accNyxPerShare) / ACC_PRECISION - u.rewardDebt;
    }

    /// @notice Accrues `pid`'s reward up to now and mints it into this contract's own
    /// balance. Safe to call any time by anyone; deposit()/withdraw() already do.
    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        if (block.timestamp <= pool.lastRewardTime) return;

        if (pool.totalStaked == 0 || totalAllocPoint == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - pool.lastRewardTime;
        uint256 reward = (elapsed * nyxPerSecond * pool.allocPoint) / totalAllocPoint;
        pool.accNyxPerShare += (reward * ACC_PRECISION) / pool.totalStaked;
        pool.lastRewardTime = block.timestamp;
        nyxToken.mint(address(this), reward);
    }

    /// @notice Stakes `amount` more of pid's LP token (or 0, to just claim without
    /// adding), paying out any already-accrued pending reward first.
    function deposit(uint256 pid, uint256 amount) external {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage u = userInfo[pid][msg.sender];
        updatePool(pid);

        _claimPending(pid, pool, u);

        if (amount > 0) {
            require(pool.lpToken.transferFrom(msg.sender, address(this), amount), "NyxSwap: transferFrom failed");
            u.amount += amount;
            pool.totalStaked += amount;
        }
        u.rewardDebt = (u.amount * pool.accNyxPerShare) / ACC_PRECISION;

        emit Deposit(msg.sender, pid, amount);
    }

    /// @notice Unstakes `amount` of pid's LP token (or 0, to just claim), paying out
    /// any accrued pending reward first.
    function withdraw(uint256 pid, uint256 amount) external {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage u = userInfo[pid][msg.sender];
        require(u.amount >= amount, "NyxSwap: insufficient staked balance");
        updatePool(pid);

        _claimPending(pid, pool, u);

        if (amount > 0) {
            u.amount -= amount;
            pool.totalStaked -= amount;
            require(pool.lpToken.transfer(msg.sender, amount), "NyxSwap: transfer failed");
        }
        u.rewardDebt = (u.amount * pool.accNyxPerShare) / ACC_PRECISION;

        emit Withdraw(msg.sender, pid, amount);
    }

    function transferOwner(address next) external onlyOwner {
        require(next != address(0), "NyxSwap: next owner zero");
        emit OwnerTransferred(owner, next);
        owner = next;
    }

    function _claimPending(uint256 pid, PoolInfo storage pool, UserInfo storage u) internal {
        if (u.amount == 0) return;
        uint256 pending = (u.amount * pool.accNyxPerShare) / ACC_PRECISION - u.rewardDebt;
        if (pending == 0) return;
        require(nyxToken.transfer(msg.sender, pending), "NyxSwap: reward transfer failed");
        emit RewardClaimed(msg.sender, pid, pending);
    }
}
