// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UnpoisonWallet} from "./UnpoisonWallet.sol";

/// @title UnpoisonFactory
/// @notice Deploys one UnpoisonWallet per owner.
contract UnpoisonFactory {
    address public immutable usdc;
    mapping(address => address) public walletOf;

    event WalletCreated(address indexed owner, address indexed wallet);

    error AlreadyHasWallet();

    constructor(address _usdc) {
        usdc = _usdc;
    }

    /// @param escrowDelay Seconds an Undo payment waits. Min 60 (demo), 3600 recommended.
    function createWallet(uint256 escrowDelay) external returns (address wallet) {
        if (walletOf[msg.sender] != address(0)) revert AlreadyHasWallet();
        wallet = address(new UnpoisonWallet(msg.sender, usdc, escrowDelay));
        walletOf[msg.sender] = wallet;
        emit WalletCreated(msg.sender, wallet);
    }
}
