const { ethers } = require("ethers");
const poolAbi = require("./abi/poolABI.json");
const factoryAbi = require("./abi/factoryABI.json");

const pairAddress = "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE"; // type in the address of the desired pair
const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // type in the address of the desired router

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_MAIN,
    factoryAbi,
    provider
  );
  const poolContract = new ethers.Contract(
    process.env.POOL_MAIN,
    poolAbi,
    provider
  );
  const poolManager = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const tx = await poolContract.connect(poolManager).enter(
    {
      fromToken: ethers.constants.AddressZero,
      pairAddress: pairAddress,
      amount: ethers.utils.parseEther("0.003"),
      minReceiveAmount: 1,
      exchangeRouterAddress: routerAddress,
      swapOptions: [],
    },
    { gasLimit: 1000000 }
  );
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
