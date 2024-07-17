const { ethers } = require("ethers");
const factoryAbi = require("./abi/factoryProxyABI.json");
const usdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";

async function main() {
    const RPC_URL = "https://bsc-dataseed1.binance.org/";
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_ADDRESS,
    factoryAbi,
    provider
  );
  const factoryOwner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const newFactoryImpl = process.env.FACTORY_IMPL_ADDRESS;
  let tx = await factory
    .connect(factoryOwner)
    .upgradeToAndCall(newFactoryImpl,"0x", { gasLimit: 2000000 });
  await tx.wait();

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
