const { ethers } = require("ethers");
const factoryAbi = require("./abi/factoryABI.json");


async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_MAIN,
    factoryAbi,
    provider
  );
  console.log(await factory.getPoolLibraryAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
