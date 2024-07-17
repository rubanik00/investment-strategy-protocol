const hre = require("hardhat");

async function main() {
  const PoolLogic = await ethers.getContractFactory("PoolLogic");
  poolLogic = await PoolLogic.deploy();
  await poolLogic.deployed();

  const PersonalPoolLogic = await ethers.getContractFactory("PersonalPoolLogic");
  personalPoolLogic = await PersonalPoolLogic.deploy();
  await personalPoolLogic.deployed();

  const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
  factoryLogic = await FactoryLogic.deploy();
  await factoryLogic.deployed();
  console.log("factoryLogic", factoryLogic.address);

  const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
  poolLibrary = await PoolLibrary.deploy();

  console.log("poolLibrary", poolLibrary.address);
  console.log("personalPoolLogic", personalPoolLogic.address);

  let lendBorrowLibrary = process.env.LEND_LIB_GOERLI;

  if (lendBorrowLibrary == "") {
    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    lendBorrowLibrary = await LendBorrowLibrary.deploy();
    lendBorrowLibrary = lendBorrowLibrary.address;

    console.log("lendBorrowLibrary", lendBorrowLibrary);
  }

  let futuresLibrary = process.env.FUTURES_LIB_GOERLI;

  if (futuresLibrary == "") {
    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();
    futuresLibrary = futuresLibrary.address;

    console.log("futuresLibrary", futuresLibrary);
  }


  const ERC20 = await ethers.getContractFactory("TestToken20");

  erc20_1 = await ERC20.deploy(
    ethers.utils.parseUnits("100", "ether"),
    "Test1",
    "TST1"
  );
  await erc20_1.deployed();

  erc20_2 = await ERC20.deploy(
    ethers.utils.parseUnits("100", "ether"),
    "Test2",
    "TST2"
  );
  await erc20_2.deployed();
  // const erc20_1 = await hre.ethers.getContractAt(
  //   "TestToken20",
  //   process.env.ERC20_1
  // );

  // const erc20_2 = await hre.ethers.getContractAt(
  //   "TestToken20",
  //   process.env.ERC20_2
  // );

  console.log("ERC20_1: ", erc20_1.address);
  console.log("ERC20_2: ", erc20_2.address);

  const factoryParam = {
    fee: 10000,
    treasuryFund: process.env.OWNER_ADDRESS,
    storageContract: process.env.OWNER_ADDRESS,
    dexConvert: process.env.DEX_CONVERT_GOERLI,
    dexEstimate: process.env.DEX_ESTIMATE_GOERLI,
    poolLogic: poolLogic.address,
    poolLibrary: poolLibrary.address,
    personalPoolLogic: personalPoolLogic.address,
    lendBorrowLibrary: lendBorrowLibrary,
    futuresLibrary: futuresLibrary,
    networkNativeToken: process.env.WBNB,
    uniswapV2In: process.env.OWNER_ADDRESS,
    uniswapV2Out: process.env.OWNER_ADDRESS,
    venusContract: ethers.constants.AddressZero,
    horizonProtocolLib: ethers.constants.AddressZero,
    whitelistedAssets: [
      ethers.constants.AddressZero,
      erc20_1.address,
      erc20_2.address,
    ],
    whitelistedPlatforms: [process.env.OWNER_ADDRESS],
    baseUri: process.env.BASE_URI,
  };

  let bytecode2 = FactoryLogic.interface.encodeFunctionData("initialize", [
    factoryParam,
  ]);

  const FactoryProxy = await ethers.getContractFactory("FactoryProxy");
  factoryProxy = await FactoryProxy.deploy(factoryLogic.address, bytecode2);
  await factoryProxy.deployed();

  factoryProxied = await FactoryLogic.attach(factoryProxy.address);

  console.log("Factory: ", factoryProxied.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
