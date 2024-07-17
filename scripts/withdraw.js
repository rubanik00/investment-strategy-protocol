const { ethers } = require("ethers");
const poolAbi = require("./abi/poolABI.json");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const poolContract = new ethers.Contract(
    process.env.POOL_MAIN,
    poolAbi,
    provider
  );

  //   const poolManager = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const user1 = new ethers.Wallet(process.env.USER1_PK, provider);
  const user2 = new ethers.Wallet(process.env.USER2_PK, provider);

  const balanceUser1 = await poolContract.balanceOf(user1.address);
  const balanceUser2 = await poolContract.balanceOf(user2.address);

  console.log("First tx started");

  let tx = await poolContract
    .connect(user1)
    .withdraw(balanceUser1, false, ethers.constants.AddressZero, 1, {
      gasLimit: 2000000,
    });
  await tx.wait();

  console.log("Second tx started");

  tx = await poolContract
    .connect(user2)
    .withdraw(balanceUser2, false, ethers.constants.AddressZero, 1, {
      gasLimit: 2000000,
    });
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
