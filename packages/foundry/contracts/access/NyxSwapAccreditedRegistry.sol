// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapAccreditedRegistry } from "./interfaces/INyxSwapAccreditedRegistry.sol";

/// @title NyxSwap Accredited Registry
/// @notice Ported from the fce-shielded-transfers reference extension's AccreditedRegistry —
/// an owner-managed list of viewers authorized to query *other* users' private history.
/// This is a separate permission from NyxSwapAllowListAuthentication, which gates
/// participation (e.g. deposits), not audit access — see that contract's header for why
/// these are two separate allow lists instead of one shared boolean.
///
/// `accreditationRequired` defaults to false so test/dev deployments expose the audit
/// feature openly; isAccredited() short-circuits to true while it's off. Raw membership
/// stays inspectable via accreditationRecord() regardless of the gate's state.
///
/// Not wired into anything yet — see brief.md's unresolved architecture questions.
contract NyxSwapAccreditedRegistry is INyxSwapAccreditedRegistry {
    /// @notice The address that can grant/revoke accreditation and flip the gate.
    address public owner;

    /// @notice Master gate: when false, isAccredited() returns true for everyone.
    /// When true, callers must be individually accredited.
    bool public accreditationRequired;

    mapping(address => bool) private accreditedViewers;

    /// @notice Emitted when a viewer's accreditation changes.
    event AccreditedUpdated(address indexed viewer, bool allowed);

    /// @notice Emitted when the owner changes.
    event OwnerTransferred(address indexed previous, address indexed next);

    /// @notice Emitted when the master gate flips.
    event AccreditationRequiredUpdated(bool required);

    modifier onlyOwner() {
        require(msg.sender == owner, "NyxSwap: caller not owner");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "NyxSwap: owner zero");
        owner = _owner;
        emit OwnerTransferred(address(0), _owner);
        emit AccreditationRequiredUpdated(false);
    }

    /// @inheritdoc INyxSwapAccreditedRegistry
    function isAccredited(address viewer) external view override returns (bool) {
        return !accreditationRequired || accreditedViewers[viewer];
    }

    /// @notice Raw membership record, independent of the gate — for tests and admin UIs
    /// that want to see actual list membership separately from the active gate behaviour.
    /// @param viewer The address to check.
    function accreditationRecord(address viewer) external view returns (bool) {
        return accreditedViewers[viewer];
    }

    /// @notice Grants or revokes accreditation for `viewer`. Idempotent.
    /// @param viewer The address to update.
    /// @param allowed Whether `viewer` should be accredited.
    function setAccredited(address viewer, bool allowed) external onlyOwner {
        accreditedViewers[viewer] = allowed;
        emit AccreditedUpdated(viewer, allowed);
    }

    /// @notice Flips the master gate.
    /// @param required Whether accreditation should be enforced.
    function setAccreditationRequired(bool required) external onlyOwner {
        accreditationRequired = required;
        emit AccreditationRequiredUpdated(required);
    }

    /// @notice Reassigns the owner role.
    /// @param next The new owner address.
    function transferOwner(address next) external onlyOwner {
        require(next != address(0), "NyxSwap: next owner zero");
        emit OwnerTransferred(owner, next);
        owner = next;
    }
}
