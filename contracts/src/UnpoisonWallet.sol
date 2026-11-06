// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title UnpoisonWallet
/// @notice A USDC wallet that makes address poisoning fail:
///         - contacts are added only when the contact signs an invite (pairing)
///         - payments to an address that LOOKS like a contact are stopped
///         - payments to unknown addresses wait in escrow (Undo) or must be claimed (Handshake)
contract UnpoisonWallet is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    enum Kind {
        Undo,
        Handshake
    }

    enum Status {
        Pending,
        Released,
        Cancelled,
        Claimed,
        Refunded
    }

    struct Escrow {
        address to;
        uint256 amount;
        uint64 unlockAt; // Undo: release time. Handshake: claim deadline.
        Kind kind;
        Status status;
        bytes32 secretHash; // Handshake only
    }

    struct Invite {
        uint64 expiresAt;
        bool used;
    }

    struct Contact {
        address addr;
        string name;
    }

    struct Vault {
        string label;
        uint64 activeAt;
    }

    struct PendingChange {
        uint256 newDelay;
        bool disableProtection;
        uint64 applyAt;
        bool exists;
    }

    // ------------------------------------------------------------ constants

    bytes32 public constant PAIR_TYPEHASH = keccak256("Pair(address wallet,bytes32 codeHash,uint256 deadline)");
    uint256 public constant MATCH_CHARS = 3; // lowest match seen in real thefts ($50M case)
    uint256 public constant MAX_CONTACTS = 50;
    uint64 public constant INVITE_MAX = 24 hours;
    uint64 public constant TIMELOCK = 24 hours;
    uint64 public constant MIN_WINDOW = 60;
    uint64 public constant MAX_WINDOW = 7 days;

    // --------------------------------------------------------------- storage

    IERC20 public immutable usdc;
    address public immutable owner;

    uint256 public escrowDelay;
    bool public protectionEnabled = true;
    uint256 public totalLocked;

    mapping(bytes32 => Invite) public invites; // codeHash => invite
    mapping(address => string) private contactName;
    mapping(address => bool) public isContact;
    address[] private contactList;

    mapping(address => Vault) public vaults;

    Escrow[] private escrows;
    PendingChange public pendingChange;

    // ---------------------------------------------------------------- events

    event InviteCreated(bytes32 indexed codeHash, uint64 expiresAt);
    event Paired(address indexed contact, string name);
    event ContactRemoved(address indexed contact);
    event Sent(address indexed to, uint256 amount);
    event Escrowed(uint256 indexed id, address indexed to, uint256 amount, uint64 releaseAt);
    event Cancelled(uint256 indexed id);
    event Released(uint256 indexed id);
    event HandshakeCreated(uint256 indexed id, address indexed to, uint256 amount, uint64 deadline);
    event Claimed(uint256 indexed id);
    event Refunded(uint256 indexed id);
    event VaultProposed(address indexed addr, string label, uint64 activeAt);
    event ChangeProposed(uint256 newDelay, bool disableProtection, uint64 applyAt);
    event ChangeApplied(uint256 escrowDelay, bool protectionEnabled);
    event ChangeCancelled();
    event SettingsTightened(uint256 escrowDelay, bool protectionEnabled);

    // ---------------------------------------------------------------- errors

    error NotOwner();
    error LookalikeStopped(address contact);
    error InsufficientAvailable();
    error InvalidInvite();
    error InvalidSignature();
    error AlreadyContact();
    error TooManyContacts();
    error WrongMiddle();
    error BadState();
    error TooEarly();
    error TooLate();
    error NotReceiver();
    error WrongSecret();
    error BadWindow();
    error BadDelay();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _usdc, uint256 _escrowDelay) EIP712("Unpoison", "1") {
        if (_owner == address(0) || _usdc == address(0)) revert ZeroAddress();
        if (_escrowDelay < MIN_WINDOW) revert BadDelay();
        owner = _owner;
        usdc = IERC20(_usdc);
        escrowDelay = _escrowDelay;
    }

    /// @dev On Arc, native USDC and ERC-20 USDC share one balance, so plain sends must be accepted.
    receive() external payable {}

    // ============================================================== pairing

    function createInvite(bytes32 codeHash, uint64 expiresAt) external onlyOwner {
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + INVITE_MAX) revert InvalidInvite();
        if (invites[codeHash].expiresAt != 0) revert InvalidInvite();
        invites[codeHash] = Invite(expiresAt, false);
        emit InviteCreated(codeHash, expiresAt);
    }

    /// @notice Owner submits the contact's signature. The signer must be `contact`,
    ///         so a bot copying the signature can only ever pair the real contact.
    function pairWithSignature(
        address contact,
        string calldata name,
        string calldata code,
        uint256 deadline,
        bytes calldata signature
    ) external onlyOwner {
        bytes32 codeHash = keccak256(bytes(code));
        Invite storage inv = invites[codeHash];
        if (inv.expiresAt == 0 || inv.used || inv.expiresAt < block.timestamp) revert InvalidInvite();
        if (deadline < block.timestamp) revert InvalidSignature();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(PAIR_TYPEHASH, address(this), codeHash, deadline)));
        if (ECDSA.recover(digest, signature) != contact) revert InvalidSignature();

        if (isContact[contact]) revert AlreadyContact();
        if (contactList.length >= MAX_CONTACTS) revert TooManyContacts();

        inv.used = true;
        isContact[contact] = true;
        contactName[contact] = name;
        contactList.push(contact);
        emit Paired(contact, name);
    }

    function removeContact(address contact) external onlyOwner {
        if (!isContact[contact]) revert BadState();
        isContact[contact] = false;
        delete contactName[contact];
        uint256 n = contactList.length;
        for (uint256 i = 0; i < n; i++) {
            if (contactList[i] == contact) {
                contactList[i] = contactList[n - 1];
                contactList.pop();
                break;
            }
        }
        emit ContactRemoved(contact);
    }

    // ============================================================ lookalike

    /// @dev Hex character `i` (0 = first after 0x, 39 = last) of an address.
    function _nibble(address a, uint256 i) private pure returns (uint8) {
        return uint8((uint160(a) >> (4 * (39 - i))) & 0xf);
    }

    /// @notice True when `a` and `b` differ but share >= 3 leading AND >= 3 trailing hex characters.
    function isLookalike(address a, address b) public pure returns (bool) {
        if (a == b) return false;
        for (uint256 i = 0; i < MATCH_CHARS; i++) {
            if (_nibble(a, i) != _nibble(b, i)) return false;
            if (_nibble(a, 39 - i) != _nibble(b, 39 - i)) return false;
        }
        return true;
    }

    function looksLike(address to) public view returns (bool, address) {
        uint256 n = contactList.length;
        for (uint256 i = 0; i < n; i++) {
            if (isLookalike(to, contactList[i])) return (true, contactList[i]);
        }
        return (false, address(0));
    }

    // ============================================================== sending

    function available() public view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        return bal > totalLocked ? bal - totalLocked : 0;
    }

    function _isTrusted(address to) internal view returns (bool) {
        if (isContact[to]) return true;
        Vault storage v = vaults[to];
        return v.activeAt != 0 && v.activeAt <= block.timestamp;
    }

    /// @notice Contact or active vault: instant. Lookalike: stopped. Anything else: Undo escrow.
    function send(address to, uint256 amount) public onlyOwner nonReentrant returns (uint256 id) {
        if (to == address(0)) revert ZeroAddress();
        if (amount > available()) revert InsufficientAvailable();

        if (!protectionEnabled || _isTrusted(to)) {
            usdc.safeTransfer(to, amount);
            emit Sent(to, amount);
            return type(uint256).max;
        }
        (bool fake, address contact) = looksLike(to);
        if (fake) revert LookalikeStopped(contact);
        return _escrowUndo(to, amount);
    }

    /// @notice Same rules as send().
    function withdraw(address to, uint256 amount) external returns (uint256) {
        return send(to, amount);
    }

    /// @notice Override a lookalike stop by typing the 6 middle characters (1-based positions 17-22)
    ///         of the address. Even then the payment waits in an Undo escrow.
    function confirmWithMiddle(address to, uint256 amount, string calldata middle)
        external
        onlyOwner
        nonReentrant
        returns (uint256)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount > available()) revert InsufficientAvailable();
        bytes memory m = bytes(middle);
        if (m.length != 6) revert WrongMiddle();
        bytes16 hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 6; i++) {
            if (m[i] != hexChars[_nibble(to, 16 + i)]) revert WrongMiddle();
        }
        return _escrowUndo(to, amount);
    }

    function _escrowUndo(address to, uint256 amount) private returns (uint256 id) {
        uint64 releaseAt = uint64(block.timestamp + escrowDelay);
        id = escrows.length;
        escrows.push(Escrow(to, amount, releaseAt, Kind.Undo, Status.Pending, bytes32(0)));
        totalLocked += amount;
        emit Escrowed(id, to, amount, releaseAt);
    }

    function cancel(uint256 id) external onlyOwner {
        Escrow storage e = escrows[id];
        if (e.kind != Kind.Undo || e.status != Status.Pending) revert BadState();
        e.status = Status.Cancelled;
        totalLocked -= e.amount;
        emit Cancelled(id);
    }

    function release(uint256 id) external nonReentrant {
        Escrow storage e = escrows[id];
        if (e.kind != Kind.Undo || e.status != Status.Pending) revert BadState();
        if (block.timestamp < e.unlockAt) revert TooEarly();
        e.status = Status.Released;
        totalLocked -= e.amount;
        usdc.safeTransfer(e.to, e.amount);
        emit Released(id);
    }

    // ============================================================ handshake

    /// @notice Money waits until the receiver claims it with a secret shared off-chain.
    ///         If nobody claims it before the window ends, it can be refunded to this wallet.
    function sendHandshake(address to, uint256 amount, bytes32 secretHash, uint64 claimWindow)
        external
        onlyOwner
        nonReentrant
        returns (uint256 id)
    {
        if (to == address(0)) revert ZeroAddress();
        if (claimWindow < MIN_WINDOW || claimWindow > MAX_WINDOW) revert BadWindow();
        if (amount > available()) revert InsufficientAvailable();
        if (protectionEnabled && !_isTrusted(to)) {
            (bool fake, address contact) = looksLike(to);
            if (fake) revert LookalikeStopped(contact);
        }
        uint64 deadline = uint64(block.timestamp + claimWindow);
        id = escrows.length;
        escrows.push(Escrow(to, amount, deadline, Kind.Handshake, Status.Pending, secretHash));
        totalLocked += amount;
        emit HandshakeCreated(id, to, amount, deadline);
    }

    function claim(uint256 id, bytes32 secret) external nonReentrant {
        Escrow storage e = escrows[id];
        if (e.kind != Kind.Handshake || e.status != Status.Pending) revert BadState();
        if (msg.sender != e.to) revert NotReceiver();
        if (block.timestamp > e.unlockAt) revert TooLate();
        if (keccak256(abi.encodePacked(secret)) != e.secretHash) revert WrongSecret();
        e.status = Status.Claimed;
        totalLocked -= e.amount;
        usdc.safeTransfer(e.to, e.amount);
        emit Claimed(id);
    }

    function refund(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.kind != Kind.Handshake || e.status != Status.Pending) revert BadState();
        if (block.timestamp <= e.unlockAt) revert TooEarly();
        e.status = Status.Refunded;
        totalLocked -= e.amount;
        emit Refunded(id);
    }

    // ================================================================ vault

    /// @notice The owner's own addresses (e.g. an exchange deposit address) become instant after 24 hours.
    function proposeVault(address addr, string calldata label) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        uint64 activeAt = uint64(block.timestamp + TIMELOCK);
        vaults[addr] = Vault(label, activeAt);
        emit VaultProposed(addr, label, activeAt);
    }

    // ============================================================= settings

    /// @notice Safer changes (longer delay, protection on) apply now.
    function tighten(uint256 newDelay) external onlyOwner {
        if (newDelay < escrowDelay) revert BadDelay();
        escrowDelay = newDelay;
        protectionEnabled = true;
        emit SettingsTightened(escrowDelay, protectionEnabled);
    }

    /// @notice Riskier changes (shorter delay, protection off) wait 24 hours and can be cancelled.
    function proposeChange(uint256 newDelay, bool disableProtection) external onlyOwner {
        if (newDelay < MIN_WINDOW) revert BadDelay();
        uint64 applyAt = uint64(block.timestamp + TIMELOCK);
        pendingChange = PendingChange(newDelay, disableProtection, applyAt, true);
        emit ChangeProposed(newDelay, disableProtection, applyAt);
    }

    function applyChange() external onlyOwner {
        PendingChange memory c = pendingChange;
        if (!c.exists) revert BadState();
        if (block.timestamp < c.applyAt) revert TooEarly();
        escrowDelay = c.newDelay;
        if (c.disableProtection) protectionEnabled = false;
        delete pendingChange;
        emit ChangeApplied(escrowDelay, protectionEnabled);
    }

    function cancelChange() external onlyOwner {
        if (!pendingChange.exists) revert BadState();
        delete pendingChange;
        emit ChangeCancelled();
    }

    // ================================================================ views

    function getContacts() external view returns (Contact[] memory list) {
        uint256 n = contactList.length;
        list = new Contact[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = Contact(contactList[i], contactName[contactList[i]]);
        }
    }

    function getEscrows() external view returns (Escrow[] memory) {
        return escrows;
    }

    function escrowCount() external view returns (uint256) {
        return escrows.length;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
