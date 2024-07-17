const { ethers } = require("ethers");
const poolAbi = require("./abi/poolABI.json");
const erc20Abi = require("./abi/erc20ABI.json");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const poolContract = new ethers.Contract(
    process.env.POOL_MAIN,
    poolAbi,
    provider
  );

  const poolManager = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const user1 = new ethers.Wallet(process.env.USER1_PK, provider);
  const user2 = new ethers.Wallet(process.env.USER2_PK, provider);

  let tx = await poolContract
    .connect(user1)
    .invest(ethers.constants.AddressZero, ethers.utils.parseEther("0.002"), {
      value: ethers.utils.parseEther("0.002"),
    });
  await tx.wait();

  tx = await poolContract
    .connect(user2)
    .invest(ethers.constants.AddressZero, ethers.utils.parseEther("0.003"), {
      value: ethers.utils.parseEther("0.003"),
    });
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
