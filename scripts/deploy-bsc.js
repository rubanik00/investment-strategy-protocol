const hre = require("hardhat");

async function main() {
  const storageContract = process.env.EXCHANGE_STORAGE_CONTRACT;
  const dexConvertLibrary = process.env.DEX_CONVERT_CONTRACT;
  const dexEstimateLibrary = process.env.DEX_ESTIMATE_CONTRACT;
  const venusContract = process.env.VENUS;
  const horizonProtocolLib = process.env.HORIZON;
  const cakeAddress = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";
  const usdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
  const daiAddress = "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3";
  const usdtAddress = "0x55d398326f99059ff775485246999027b3197955";
  const btcAddress = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
  const ethAddress = "0x2170ed0880ac9a755fd29b2688956bd959f933f8";
  const wBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
  const XVS = '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63';
  const LVL = '0xB64E280e9D1B5DbEc4AcceDb2257A87b400DB149';
  const ZUSD = '0xf0186490b18cb74619816cfc7feb51cdbe4ae7b9';

  const PoolLogic = await ethers.getContractFactory("PoolLogic");
  poolLogic = await PoolLogic.deploy();
  await poolLogic.deployed();

  const PersonalPoolLogic = await ethers.getContractFactory("PersonalPoolLogic");
  personalPoolLogic = await PersonalPoolLogic.deploy();
  await personalPoolLogic.deployed();

  const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
  poolLibrary = await PoolLibrary.deploy();

  const LiquidityProvisionLibrary = await ethers.getContractFactory("LiquidityProvisionLibrary");
  liquidityProvisionLibrary = await LiquidityProvisionLibrary.deploy();

  console.log("poolLibrary", poolLibrary.address);
  console.log("poolLogic", poolLogic.address);
  console.log("personalPoolLogic", personalPoolLogic.address);
  console.log("liquidityProvisionLibrary", liquidityProvisionLibrary.address);

  let lendBorrowLibrary = process.env.LEND_LIB_MAIN;

  if (lendBorrowLibrary == "") {
    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    lendBorrowLibrary = await LendBorrowLibrary.deploy();
    lendBorrowLibrary = lendBorrowLibrary.address;

    console.log("lendBorrowLibrary", lendBorrowLibrary);
  }

  let futuresLibrary = process.env.FUTURES_LIB_MAIN;

  if (futuresLibrary == "") {
    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();
    futuresLibrary = futuresLibrary.address;

    console.log("futuresLibrary", futuresLibrary);
  }

  const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
  factoryLogic = await FactoryLogic.deploy();
  await factoryLogic.deployed();

  const factoryParam = {
    fee: 1000, // 1%
    treasuryFund: process.env.OWNER_ADDRESS,
    storageContract: storageContract,
    dexConvert: dexConvertLibrary,
    dexEstimate: dexEstimateLibrary,
    poolLogic: poolLogic.address,
    poolLibrary: poolLibrary.address,
    liquidityProvisionLibrary: liquidityProvisionLibrary.address,
    personalPoolLogic: personalPoolLogic.address,
    lendBorrowLibrary: lendBorrowLibrary,
    futuresLibrary: futuresLibrary,
    networkNativeToken: process.env.WBNB,
    uniswapV2In: process.env.UNI_IN,
    uniswapV2Out: process.env.UNI_OUT,
    venusContract: venusContract,
    horizonProtocolLib: horizonProtocolLib,
    whitelistedAssets: [
      ethers.constants.AddressZero,
      cakeAddress,
      usdcAddress,
      busdAddress,
      daiAddress,
      usdtAddress,
      btcAddress,
      ethAddress,
      wBNB,
      XVS,
      LVL,
      ZUSD
    ],
    whitelistedPlatforms: [
      dexConvertLibrary,
      dexEstimateLibrary,
      process.env.UNI_IN,
      venusContract,
      horizonProtocolLib,
      lendBorrowLibrary,
      futuresLibrary,
      poolLibrary.address,
      liquidityProvisionLibrary.address,
    ],
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
