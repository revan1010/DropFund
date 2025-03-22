// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USDC Mock", "USDC") {
        // Mint 1 million tokens with 6 decimals to the deployer
        _mint(msg.sender, 1000000 * 10**6);
    }

    // Mint function for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Override decimals to 6 like USDC
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
} 