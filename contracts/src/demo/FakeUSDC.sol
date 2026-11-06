// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice DEMO ONLY. Imitates the scam tokens used in address poisoning: it can emit a Transfer event
///         that makes it look like a victim paid the scammer, without moving any real money.
contract FakeUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function fakeTransfer(address from, address to, uint256 value) external {
        emit Transfer(from, to, value);
    }
}
