require("@nomicfoundation/hardhat-toolbox");
require("@chainsafe/hardhat-ts-artifact-plugin");
require("@nomicfoundation/hardhat-web3-v4");
require("@chainsafe/hardhat-plugin-multichain-deploy");
const { Environment } = require("@buildwithsygma/sygma-sdk-core");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      // Use process.env to access environment variables
      accounts: process.env.PK ? [process.env.PK] : [],
    },
    
    holesky: {
      chainId: 17000,
      url: "https://ethereum-holesky-rpc.publicnode.com",
      accounts: process.env.PK ? [process.env.PK] : [],
    },
  },
  multichain: {
    environment: Environment.TESTNET,
  }
};
