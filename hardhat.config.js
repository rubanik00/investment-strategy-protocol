require("dotenv").config();

// require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");
require("@nomiclabs/hardhat-web3");
require("@nomicfoundation/hardhat-verify");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 3000000000000000,
  },
  defaultNetwork: "hardhat",
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1,
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 3000000000, // 3Gwei
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 3000000000, // 3Gwei
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 5,
    },
    localhost: {
      url: `http://127.0.0.1:8545`,
      chainId: 1337,
      gasPrice: 3000000000, // 3Gwei
      gasMultiplier: 1,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
