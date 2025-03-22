// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BulkDonation
 * @dev Contract for NGOs to register, deposit funds, and recipients to claim funds
 */
contract BulkDonation is Ownable, ReentrancyGuard {
    // Token address for USDC (or any ERC20)
    address public usdcToken;

    // Struct to store NGO information
    struct NGO {
        string name;
        string description;
        address wallet;
        bool isRegistered;
    }

    // Struct to store recipient information
    struct Recipient {
        bytes32 phoneHash; // Hash of phone number for privacy
        address wallet;
        uint256 amount;
        bool claimed;
    }

    // Track all registered NGOs
    mapping(address => NGO) public ngos;
    address[] public ngoAddresses;

    // Track NGO balances
    mapping(address => uint256) public ngoAvaxBalance;
    mapping(address => uint256) public ngoTokenBalance;

    // Map phone hash to recipient data per NGO
    // NGO Address => Phone Hash => Recipient
    mapping(address => mapping(bytes32 => Recipient)) public recipients;

    // Track all registered recipients per NGO
    mapping(address => bytes32[]) public ngoRecipients;

    // Phone hash to wallet mapping for verification
    mapping(bytes32 => address) public phoneToWallet;

    // Events
    event NGORegistered(address indexed ngoAddress, string name);
    event FundsDeposited(address indexed ngoAddress, uint256 amount, bool isToken);
    event RecipientAdded(address indexed ngoAddress, bytes32 indexed phoneHash, uint256 amount);
    event PhoneRegistered(bytes32 indexed phoneHash, address indexed wallet);
    event FundsClaimed(address indexed ngoAddress, bytes32 indexed phoneHash, address indexed recipient, uint256 amount, bool isToken);
    event RecipientWalletUpdated(address indexed ngoAddress, bytes32 indexed phoneHash, address oldWallet, address newWallet);
    event ReassignmentRequested(address indexed ngoAddress, bytes32 indexed phoneHash, address currentWallet, address newWallet);

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = _usdcToken;
    }

    /**
     * @dev Register a new NGO
     * @param _name Name of the NGO
     * @param _description Description of the NGO
     */
    function registerNGO(string memory _name, string memory _description) external {
        require(!ngos[msg.sender].isRegistered, "NGO already registered");

        ngos[msg.sender] = NGO({
            name: _name,
            description: _description,
            wallet: msg.sender,
            isRegistered: true
        });

        ngoAddresses.push(msg.sender);
        
        emit NGORegistered(msg.sender, _name);
    }

    /**
     * @dev Deposit AVAX funds into the contract
     */
    function depositAvax() external payable {
        require(ngos[msg.sender].isRegistered, "Not a registered NGO");
        require(msg.value > 0, "Amount must be greater than 0");

        ngoAvaxBalance[msg.sender] += msg.value;
        
        emit FundsDeposited(msg.sender, msg.value, false);
    }

    /**
     * @dev Deposit ERC20 token funds into the contract
     * @param _amount Amount of tokens to deposit
     */
    function depositToken(uint256 _amount) external {
        require(ngos[msg.sender].isRegistered, "Not a registered NGO");
        require(_amount > 0, "Amount must be greater than 0");
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        ngoTokenBalance[msg.sender] += _amount;
        
        emit FundsDeposited(msg.sender, _amount, true);
    }

    /**
     * @dev Register a phone number with a wallet address
     * @param _phoneNumber Phone number as a string
     * @param _force Whether to force registration even if already registered to another wallet
     */
    function registerPhone(string memory _phoneNumber, bool _force) external {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // If already registered to a different address
        if (phoneToWallet[phoneHash] != address(0) && phoneToWallet[phoneHash] != msg.sender) {
            if (_force) {
                // Override existing registration if force parameter is true
                phoneToWallet[phoneHash] = msg.sender;
                emit PhoneRegistered(phoneHash, msg.sender);
            } else {
                // Otherwise revert
                revert("Phone already registered to another wallet");
            }
        } else if (phoneToWallet[phoneHash] == address(0)) {
            // If not registered, register it
            phoneToWallet[phoneHash] = msg.sender;
            emit PhoneRegistered(phoneHash, msg.sender);
        }
        // If already registered to caller, do nothing
    }

    /**
     * @dev Register a phone number with a wallet address (backward compatibility)
     * @param _phoneNumber Phone number as a string
     */
    function registerPhone(string memory _phoneNumber) external {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // If already registered to a different address, prevent registration
        if (phoneToWallet[phoneHash] != address(0)) {
            require(phoneToWallet[phoneHash] == msg.sender, "Phone already registered to another wallet");
        } else {
            // If not registered, register it
            phoneToWallet[phoneHash] = msg.sender;
            emit PhoneRegistered(phoneHash, msg.sender);
        }
    }

    /**
     * @dev Add recipients in bulk
     * @param _phoneNumbers Array of phone numbers
     * @param _walletAddresses Array of wallet addresses
     * @param _amounts Array of amounts
     * @param _isToken Whether to use token or AVAX
     */
    function addRecipients(
        string[] memory _phoneNumbers,
        address[] memory _walletAddresses,
        uint256[] memory _amounts,
        bool _isToken
    ) external {
        require(ngos[msg.sender].isRegistered, "Not a registered NGO");
        require(_phoneNumbers.length == _walletAddresses.length && _walletAddresses.length == _amounts.length, "Array lengths must match");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }

        if (_isToken) {
            require(ngoTokenBalance[msg.sender] >= totalAmount, "Insufficient token balance");
        } else {
            require(ngoAvaxBalance[msg.sender] >= totalAmount, "Insufficient AVAX balance");
        }

        for (uint256 i = 0; i < _phoneNumbers.length; i++) {
            bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumbers[i]));
            
            // Add or update recipient
            recipients[msg.sender][phoneHash] = Recipient({
                phoneHash: phoneHash,
                wallet: _walletAddresses[i],
                amount: _amounts[i],
                claimed: false
            });

            // Add to the list if not already added
            bool found = false;
            for (uint256 j = 0; j < ngoRecipients[msg.sender].length; j++) {
                if (ngoRecipients[msg.sender][j] == phoneHash) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                ngoRecipients[msg.sender].push(phoneHash);
            }

            emit RecipientAdded(msg.sender, phoneHash, _amounts[i]);
        }

        // Update NGO balance
        if (_isToken) {
            ngoTokenBalance[msg.sender] -= totalAmount;
        } else {
            ngoAvaxBalance[msg.sender] -= totalAmount;
        }
    }

    /**
     * @dev Claim funds for a recipient
     * @param _phoneNumber Phone number as a string
     * @param _ngoAddress Address of the NGO
     * @param _isToken Whether to claim token or AVAX
     */
    function claimFunds(string memory _phoneNumber, address _ngoAddress, bool _isToken) external nonReentrant {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // Verify the caller owns this phone
        require(phoneToWallet[phoneHash] == msg.sender, "Not authorized to claim for this phone");
        
        // Get recipient data
        Recipient storage recipient = recipients[_ngoAddress][phoneHash];
        require(recipient.amount > 0, "No funds to claim");
        require(!recipient.claimed, "Funds already claimed");
        
        // Mark as claimed
        recipient.claimed = true;
        
        // Transfer funds
        if (_isToken) {
            require(IERC20(usdcToken).transfer(msg.sender, recipient.amount), "Token transfer failed");
        } else {
            (bool success, ) = payable(msg.sender).call{value: recipient.amount}("");
            require(success, "AVAX transfer failed");
        }
        
        emit FundsClaimed(_ngoAddress, phoneHash, msg.sender, recipient.amount, _isToken);
    }

    /**
     * @dev Get claimable funds for a phone number from a specific NGO
     * @param _phoneNumber Phone number as a string
     * @param _ngoAddress Address of the NGO
     * @return amount The amount available to claim
     * @return claimed Whether the funds have been claimed
     */
    function getClaimableAmount(string memory _phoneNumber, address _ngoAddress) external view returns (uint256 amount, bool claimed) {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        Recipient storage recipient = recipients[_ngoAddress][phoneHash];
        return (recipient.amount, recipient.claimed);
    }

    /**
     * @dev Claim funds directly (simplified approach)
     * @param _phoneNumber Phone number as a string
     * @param _ngoAddress Address of the NGO
     * @param _isToken Whether to claim token or AVAX
     */
    function claimDirectly(string memory _phoneNumber, address _ngoAddress, bool _isToken) external nonReentrant {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // Get recipient data
        Recipient storage recipient = recipients[_ngoAddress][phoneHash];
        require(recipient.amount > 0, "No funds to claim");
        require(!recipient.claimed, "Funds already claimed");
        
        // Mark as claimed
        recipient.claimed = true;
        
        // Transfer funds to caller regardless of wallet assignment
        if (_isToken) {
            require(IERC20(usdcToken).transfer(msg.sender, recipient.amount), "Token transfer failed");
        } else {
            (bool success, ) = payable(msg.sender).call{value: recipient.amount}("");
            require(success, "AVAX transfer failed");
        }
        
        emit FundsClaimed(_ngoAddress, phoneHash, msg.sender, recipient.amount, _isToken);
    }

    /**
     * @dev Get all NGOs
     * @return An array of NGO addresses
     */
    function getAllNGOs() external view returns (address[] memory) {
        return ngoAddresses;
    }

    /**
     * @dev Get all recipients for an NGO
     * @param _ngoAddress Address of the NGO
     * @return An array of recipient phone hashes
     */
    function getNGORecipients(address _ngoAddress) external view returns (bytes32[] memory) {
        return ngoRecipients[_ngoAddress];
    }

    /**
     * @dev Set a new USDC token address
     * @param _newToken New token address
     */
    function setTokenAddress(address _newToken) external onlyOwner {
        usdcToken = _newToken;
    }

    /**
     * @dev Update a recipient's wallet address - can only be called by the NGO that added the recipient
     * @param _phoneNumber Phone number of the recipient to update
     * @param _newWalletAddress New wallet address to assign to this recipient
     * @return success Whether the update was successful
     */
    function updateRecipientWallet(string memory _phoneNumber, address _newWalletAddress) external returns (bool success) {
        require(ngos[msg.sender].isRegistered, "Not a registered NGO");
        require(_newWalletAddress != address(0), "Invalid wallet address");
        
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // Get recipient data
        Recipient storage recipient = recipients[msg.sender][phoneHash];
        
        // Ensure recipient exists and has not claimed funds yet
        require(recipient.amount > 0, "Recipient not found");
        require(!recipient.claimed, "Funds already claimed");
        
        // Store old wallet for event
        address oldWallet = recipient.wallet;
        
        // Update wallet address
        recipient.wallet = _newWalletAddress;
        
        // Emit event
        emit RecipientWalletUpdated(msg.sender, phoneHash, oldWallet, _newWalletAddress);
        
        return true;
    }

    /**
     * @dev Request reassignment of funds to the caller's wallet
     * @param _phoneNumber Phone number as a string
     * @param _ngoAddress Address of the NGO
     * @return success Whether the request was successful
     */
    function requestWalletReassignment(string memory _phoneNumber, address _ngoAddress) external returns (bool success) {
        bytes32 phoneHash = keccak256(abi.encodePacked(_phoneNumber));
        
        // Register this phone to the caller's wallet if not already registered
        if (phoneToWallet[phoneHash] == address(0)) {
            phoneToWallet[phoneHash] = msg.sender;
            emit PhoneRegistered(phoneHash, msg.sender);
        }
        
        // Verify the caller's wallet is associated with this phone
        require(phoneToWallet[phoneHash] == msg.sender, "Phone not registered to your wallet");
        
        // Get recipient data from the specified NGO
        Recipient storage recipient = recipients[_ngoAddress][phoneHash];
        
        // Ensure recipient exists
        require(recipient.amount > 0, "No funds assigned to this phone");
        
        // Ensure the funds are not already claimed
        require(!recipient.claimed, "Funds already claimed");
        
        // Ensure the funds are assigned to a different wallet
        require(recipient.wallet != msg.sender, "Funds already assigned to your wallet");
        
        // Store old wallet for event
        address oldWallet = recipient.wallet;
        
        // Update wallet address to caller
        recipient.wallet = msg.sender;
        
        // Emit events
        emit ReassignmentRequested(_ngoAddress, phoneHash, oldWallet, msg.sender);
        emit RecipientWalletUpdated(_ngoAddress, phoneHash, oldWallet, msg.sender);
        
        return true;
    }
} 