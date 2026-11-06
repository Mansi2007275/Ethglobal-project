// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {UnpoisonFactory} from "../src/UnpoisonFactory.sol";

/// forge script script/Deploy.s.sol --rpc-url arc_testnet --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract Deploy is Script {
    // USDC ERC-20 interface on Arc (6 decimals)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (UnpoisonFactory factory) {
        vm.startBroadcast();
        factory = new UnpoisonFactory(ARC_USDC);
        vm.stopBroadcast();
        console2.log("UnpoisonFactory:", address(factory));
    }
}
