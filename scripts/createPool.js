const { ethers } = require("ethers");
const factoryAbi = require("./abi/factoryABI.json");
const usdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_ADDRESS,
    factoryAbi,
    provider
  );
  const factoryOwner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const poolParams = {
    privacyStatus: false,
    published: true,
    lockPeriodInSec: 1,
    frequency: 0,
    feePercentage: 10000,
    name: "Test Pool",
    symbol: "TPL",
    feeCollector: factoryOwner.address,
    supportedAssets: [],
    supportedPlatforms: [],
    whitelistedUsers: [],
    redemptionSupportedAssets: [],
    risk: 0,
    minInvestmentAmount: ethers.utils.parseUnits("0.0001", "ether"),
    maxInvestmentAmount: ethers.utils.parseUnits("5000", "ether"),
    entryFee:{
      isFixedAmount: false,
      feeAmount:0
    },
    exitFee:{
      isFixedAmount: false,
      feeAmount:0
    },
    autoSwap: {
      isAutoSwapOn: false,
      autoSwapToken: ethers.constants.AddressZero
    }
  };

  let tx = await factory
    .connect(factoryOwner)
    .createPool(poolParams, { gasLimit: 2000000 });
  await tx.wait();

  const poolsArray = await factory.getPoolAddresses();
  console.log(poolsArray);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
