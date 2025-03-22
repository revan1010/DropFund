require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: ["684a379302d4fa3bf701a971bb9ddda970cd18c9c24ee9b8d27aa5e1d42b3f85"],
    },
  },
};
