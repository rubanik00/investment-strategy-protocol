const hre = require("hardhat");
const poolAbi = require("./abi/poolABI.json");
const factoryAbi = require("./abi/factoryABI.json");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_MAIN,
    factoryAbi,
    provider
  );

  // const PoolLibrary = await hre.ethers.getContractFactory("PoolLibrary");
  // const poolLibrary = await PoolLibrary.deploy();
  // await poolLibrary.deployed();

  // console.log("Pool Lib address: ", poolLibrary.address);

  const tx = await factory.setPoolLibrary("POOL_LIB_ADDRESS");
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
