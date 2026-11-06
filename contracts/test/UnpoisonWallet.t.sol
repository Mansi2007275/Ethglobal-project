// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UnpoisonFactory} from "../src/UnpoisonFactory.sol";
import {UnpoisonWallet} from "../src/UnpoisonWallet.sol";
import {MockUSDC, ReentrantToken} from "./mocks/MockUSDC.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UnpoisonWalletTest is Test {
    MockUSDC usdc;
    UnpoisonFactory factory;
    UnpoisonWallet wallet;

    address rahul = makeAddr("rahul");
    uint256 amitKey = 0xA11CE;
    address amit;

    // Lookalike of Amit: same first 3 and last 3 hex chars, different middle.
    address fake;
    address stranger = makeAddr("stranger");

    uint256 constant DELAY = 60;
    uint256 constant ONE = 1e6;

    function setUp() public {
        amit = vm.addr(amitKey);
        fake = _lookalike(amit, 3);

        usdc = new MockUSDC();
        factory = new UnpoisonFactory(address(usdc));
        vm.prank(rahul);
        wallet = UnpoisonWallet(payable(factory.createWallet(DELAY)));
        usdc.mint(address(wallet), 100 * ONE);
    }

    // ------------------------------------------------------------ helpers

    /// Keeps `keep` leading and trailing hex chars of `a`, flips everything in between.
    function _lookalike(address a, uint256 keep) internal pure returns (address) {
        uint160 x = uint160(a);
        uint160 middleMask;
        for (uint256 i = keep; i < 40 - keep; i++) {
            middleMask |= uint160(0xf) << (4 * (39 - i));
        }
        return address(x ^ (middleMask & uint160(0x4444444444444444444444444444444444444444)));
    }

    function _pairSig(UnpoisonWallet w, uint256 key, string memory code, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(w.PAIR_TYPEHASH(), address(w), keccak256(bytes(code)), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", w.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _pairAmit() internal {
        string memory code = "code-amit";
        vm.startPrank(rahul);
        wallet.createInvite(keccak256(bytes(code)), uint64(block.timestamp + 1 hours));
        uint256 deadline = block.timestamp + 1 hours;
        wallet.pairWithSignature(amit, "Amit", code, deadline, _pairSig(wallet, amitKey, code, deadline));
        vm.stopPrank();
    }

    function _middle(address a) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory out = new bytes(6);
        for (uint256 i = 0; i < 6; i++) {
            out[i] = hexChars[uint8((uint160(a) >> (4 * (39 - (16 + i)))) & 0xf)];
        }
        return string(out);
    }

    // ------------------------------------------------------------ pairing

    function test_pairing_addsContact() public {
        _pairAmit();
        assertTrue(wallet.isContact(amit));
        UnpoisonWallet.Contact[] memory list = wallet.getContacts();
        assertEq(list.length, 1);
        assertEq(list[0].name, "Amit");
    }

    function test_invite_reuseFails() public {
        _pairAmit();
        uint256 deadline = block.timestamp + 1 hours;
        uint256 otherKey = 0xB0B;
        bytes memory sig = _pairSig(wallet, otherKey, "code-amit", deadline);
        vm.prank(rahul);
        vm.expectRevert(UnpoisonWallet.InvalidInvite.selector);
        wallet.pairWithSignature(vm.addr(otherKey), "Bob", "code-amit", deadline, sig);
    }

    function test_invite_expiryFails() public {
        string memory code = "late";
        vm.prank(rahul);
        wallet.createInvite(keccak256(bytes(code)), uint64(block.timestamp + 10 minutes));
        vm.warp(block.timestamp + 11 minutes);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _pairSig(wallet, amitKey, code, deadline);
        vm.prank(rahul);
        vm.expectRevert(UnpoisonWallet.InvalidInvite.selector);
        wallet.pairWithSignature(amit, "Amit", code, deadline, sig);
    }

    function test_invite_tooLongFails() public {
        vm.prank(rahul);
        vm.expectRevert(UnpoisonWallet.InvalidInvite.selector);
        wallet.createInvite(keccak256("x"), uint64(block.timestamp + 25 hours));
    }

    function test_pairing_wrongSignerFails() public {
        string memory code = "c1";
        vm.prank(rahul);
        wallet.createInvite(keccak256(bytes(code)), uint64(block.timestamp + 1 hours));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _pairSig(wallet, 0xBAD, code, deadline); // signed by someone else
        vm.prank(rahul);
        vm.expectRevert(UnpoisonWallet.InvalidSignature.selector);
        wallet.pairWithSignature(amit, "Amit", code, deadline, sig);
    }

    function test_pairing_replayOnOtherWalletFails() public {
        address priya = makeAddr("priya");
        vm.prank(priya);
        UnpoisonWallet other = UnpoisonWallet(payable(factory.createWallet(DELAY)));

        string memory code = "shared";
        vm.prank(rahul);
        wallet.createInvite(keccak256(bytes(code)), uint64(block.timestamp + 1 hours));
        vm.prank(priya);
        other.createInvite(keccak256(bytes(code)), uint64(block.timestamp + 1 hours));

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigForRahul = _pairSig(wallet, amitKey, code, deadline);
        vm.prank(priya);
        vm.expectRevert(UnpoisonWallet.InvalidSignature.selector);
        other.pairWithSignature(amit, "Amit", code, deadline, sigForRahul);
    }

    function test_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(UnpoisonWallet.NotOwner.selector);
        wallet.send(stranger, ONE);
    }

    // ------------------------------------------------------------ sending

    function test_send_toContact_isInstant() public {
        _pairAmit();
        vm.prank(rahul);
        wallet.send(amit, 5 * ONE);
        assertEq(usdc.balanceOf(amit), 5 * ONE);
        assertEq(wallet.totalLocked(), 0);
    }

    function test_send_toUnknown_isEscrowed() public {
        vm.prank(rahul);
        uint256 id = wallet.send(stranger, 5 * ONE);
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(wallet.totalLocked(), 5 * ONE);
        assertEq(wallet.getEscrows()[id].amount, 5 * ONE);
    }

    function test_cancel_refundsAndUnlocks() public {
        vm.startPrank(rahul);
        uint256 id = wallet.send(stranger, 5 * ONE);
        wallet.cancel(id);
        vm.stopPrank();
        assertEq(wallet.totalLocked(), 0);
        assertEq(wallet.available(), 100 * ONE);
        vm.expectRevert(UnpoisonWallet.BadState.selector);
        wallet.release(id);
    }

    function test_release_beforeDelayFails_afterWorks() public {
        vm.prank(rahul);
        uint256 id = wallet.send(stranger, 5 * ONE);
        vm.expectRevert(UnpoisonWallet.TooEarly.selector);
        wallet.release(id);
        vm.warp(block.timestamp + DELAY);
        wallet.release(id);
        assertEq(usdc.balanceOf(stranger), 5 * ONE);
        assertEq(wallet.totalLocked(), 0);
    }

    function test_lookalike_3plus3_isStopped() public {
        _pairAmit();
        assertTrue(wallet.isLookalike(fake, amit));
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(UnpoisonWallet.LookalikeStopped.selector, amit));
        wallet.send(fake, ONE);
    }

    function test_lookalike_2plus2_notStopped() public {
        _pairAmit();
        address weak = _lookalike(amit, 2);
        // make sure the 3rd char differs on both ends
        assertFalse(wallet.isLookalike(weak, amit));
        vm.prank(rahul);
        wallet.send(weak, ONE); // escrowed, not reverted
        assertEq(wallet.totalLocked(), ONE);
    }

    function test_middleCheck_rightAndWrong() public {
        _pairAmit();
        vm.startPrank(rahul);
        vm.expectRevert(UnpoisonWallet.WrongMiddle.selector);
        wallet.confirmWithMiddle(fake, ONE, "000000");
        uint256 id = wallet.confirmWithMiddle(fake, ONE, _middle(fake));
        vm.stopPrank();
        assertEq(uint8(wallet.getEscrows()[id].kind), uint8(UnpoisonWallet.Kind.Undo));
        assertEq(usdc.balanceOf(fake), 0);
    }

    function test_lockedFunds_cannotBeSpentTwice() public {
        vm.startPrank(rahul);
        wallet.send(stranger, 80 * ONE);
        vm.expectRevert(UnpoisonWallet.InsufficientAvailable.selector);
        wallet.send(makeAddr("other"), 30 * ONE);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ handshake

    function test_handshake_claimByReceiver() public {
        bytes32 secret = keccak256("s3cret");
        vm.prank(rahul);
        uint256 id = wallet.sendHandshake(stranger, 7 * ONE, keccak256(abi.encodePacked(secret)), 1 hours);
        vm.prank(stranger);
        wallet.claim(id, secret);
        assertEq(usdc.balanceOf(stranger), 7 * ONE);
        assertEq(wallet.totalLocked(), 0);
    }

    function test_handshake_otherAddressCannotClaim() public {
        bytes32 secret = keccak256("s3cret");
        vm.prank(rahul);
        uint256 id = wallet.sendHandshake(stranger, ONE, keccak256(abi.encodePacked(secret)), 1 hours);
        vm.prank(makeAddr("thief"));
        vm.expectRevert(UnpoisonWallet.NotReceiver.selector);
        wallet.claim(id, secret);
    }

    function test_handshake_wrongSecretFails() public {
        vm.prank(rahul);
        uint256 id = wallet.sendHandshake(stranger, ONE, keccak256(abi.encodePacked(bytes32("a"))), 1 hours);
        vm.prank(stranger);
        vm.expectRevert(UnpoisonWallet.WrongSecret.selector);
        wallet.claim(id, bytes32("b"));
    }

    function test_handshake_refundAfterWindow_noClaimAfter() public {
        bytes32 secret = keccak256("s");
        vm.prank(rahul);
        uint256 id = wallet.sendHandshake(stranger, 3 * ONE, keccak256(abi.encodePacked(secret)), 60);
        vm.expectRevert(UnpoisonWallet.TooEarly.selector);
        wallet.refund(id);
        vm.warp(block.timestamp + 61);
        vm.prank(stranger);
        vm.expectRevert(UnpoisonWallet.TooLate.selector);
        wallet.claim(id, secret);
        wallet.refund(id);
        assertEq(wallet.totalLocked(), 0);
        assertEq(wallet.available(), 100 * ONE);
    }

    function test_handshake_lookalikeStopped() public {
        _pairAmit();
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(UnpoisonWallet.LookalikeStopped.selector, amit));
        wallet.sendHandshake(fake, ONE, bytes32(0), 1 hours);
    }

    // ------------------------------------------------------------ vault + settings

    function test_vault_activeAfter24h() public {
        address deposit = makeAddr("binance-deposit");
        vm.prank(rahul);
        wallet.proposeVault(deposit, "My Binance deposit");
        vm.prank(rahul);
        wallet.send(deposit, ONE); // not active yet -> escrow
        assertEq(wallet.totalLocked(), ONE);
        vm.warp(block.timestamp + 24 hours);
        vm.prank(rahul);
        wallet.send(deposit, ONE); // now instant
        assertEq(usdc.balanceOf(deposit), ONE);
    }

    function test_timelock_riskyChangeWaits() public {
        vm.startPrank(rahul);
        wallet.proposeChange(60, true);
        vm.expectRevert(UnpoisonWallet.TooEarly.selector);
        wallet.applyChange();
        vm.warp(block.timestamp + 24 hours);
        wallet.applyChange();
        vm.stopPrank();
        assertFalse(wallet.protectionEnabled());
    }

    function test_timelock_cancel() public {
        vm.startPrank(rahul);
        wallet.proposeChange(60, true);
        wallet.cancelChange();
        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert(UnpoisonWallet.BadState.selector);
        wallet.applyChange();
        vm.stopPrank();
        assertTrue(wallet.protectionEnabled());
    }

    function test_saferChange_isInstant() public {
        vm.prank(rahul);
        wallet.tighten(2 hours);
        assertEq(wallet.escrowDelay(), 2 hours);
        vm.prank(rahul);
        vm.expectRevert(UnpoisonWallet.BadDelay.selector);
        wallet.tighten(30);
    }

    // ------------------------------------------------------------ factory + reentrancy

    function test_factory_oneWalletPerOwner() public {
        vm.prank(rahul);
        vm.expectRevert(UnpoisonFactory.AlreadyHasWallet.selector);
        factory.createWallet(DELAY);
        assertEq(factory.walletOf(rahul), address(wallet));
    }

    function test_reentrancy_blocked() public {
        ReentrantToken evil = new ReentrantToken();
        UnpoisonWallet w = new UnpoisonWallet(rahul, address(evil), DELAY);
        evil.mint(address(w), 100 * ONE);

        vm.prank(rahul);
        uint256 id = w.send(stranger, ONE);
        vm.warp(block.timestamp + DELAY);
        evil.arm(address(w), abi.encodeCall(UnpoisonWallet.release, (id)));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        w.release(id);
    }
}
