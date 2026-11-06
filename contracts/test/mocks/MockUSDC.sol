// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Token that tries to re-enter the wallet during transfer.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public payload;

    constructor() ERC20("Evil", "EVL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address _target, bytes calldata _payload) external {
        target = _target;
        payload = _payload;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (target != address(0) && from == target) {
            address t = target;
            target = address(0);
            (bool ok, bytes memory ret) = t.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }
}
