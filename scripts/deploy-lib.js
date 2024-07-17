const hre = require("hardhat");
const factoryAbi = require("./abi/factoryABI.json");

async function main() {
  let lendBorrowLibrary = process.env.LEND_LIB_MAIN;
  const wBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
  // let futuresLibrary;
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(
    process.env.FACTORY_MAIN,
    factoryAbi,
    provider
  );
  const factoryOwner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  // // LEND_BORROW
  if (lendBorrowLibrary == "") {
    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    lendBorrowLibrary = await LendBorrowLibrary.deploy();
    lendBorrowLibrary = lendBorrowLibrary.address;
    console.log("lendBorrowLibrary", lendBorrowLibrary);
  }
  let tx = await factory
    .connect(factoryOwner)
    .setLendBorrowLib(lendBorrowLibrary);
  await tx.wait();
  console.log(
    "New LendBorrow Lib set: ",
    await factory.connect(factoryOwner).getLendBorrowLibraryAddress()
  );
  // //

  // // ADD_NEW_ASSET
  // let tx = await factory
  //   .connect(factoryOwner)
  //   .manageAssetsToWhitelist([wBNB], true);
  // await tx.wait();
  // //
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
