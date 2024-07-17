const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("PoolFork", function () {
  let accounts;
  let owner;
  let user;
  let poolManager;
  let factoryProxied;
  let platform1, platform2;
  let poolContract;
  let convertContract;
  const fee = "10000"; // = 10%
  const lockPeriodInSec = "1";
  const baseURI = "https://goerli.infura.io/v3/";
  const storageContract = process.env.EXCHANGE_STORAGE_CONTRACT;
  const dexConvertLibrary = process.env.DEX_CONVERT_CONTRACT;
  const dexEstimateLibrary = process.env.DEX_ESTIMATE_CONTRACT;
  const venusContract = process.env.VENUS;
  const horizonProtocolLib = process.env.HORIZON;
  const cakeAddress = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";
  const usdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
  const uniswapV2In = "0xA961f342439Cc9296cD4A638e0fb893E8c350237";
  const uniswapV2Out = "0xFaD13EBaB3086b04da129AD1636063E78B5CC20f";
  const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const routerAddress2 = "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607";
  const pairAddress = "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE";
  const pairAddress2 = "0x7EFaEf62fDdCCa950418312c6C91Aef321375A00";
  const vBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
  const vUSDC = "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8";
  const vCAKE = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";
  const wBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
  let busd, usdc;
  let pairContract;
  let pairContract2;
  let lpAmount;
  let poolLibrary;
  let lendBorrowLibrary;
  let futuresLibrary;
  let vUsdc;
  let venusProtocolLib, liquidityProvisionLibrary;

  const risk = 10;

  before("setup others", async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    poolManager = accounts[2];
    platform1 = accounts[3];
    platform2 = accounts[4];

    busd = await ethers.getContractAt("IERC20", busdAddress);
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    vUsdc = await ethers.getContractAt("IERC20", vUSDC);
    pairContract = await ethers.getContractAt("IERC20", pairAddress);
    pairContract2 = await ethers.getContractAt("IERC20", pairAddress2);
    dexEstimateContract = await ethers.getContractAt(
      "IDexEstimateLibrary",
      dexEstimateLibrary
    );

    const PoolLogic = await ethers.getContractFactory("PoolLogic");
    const poolLogic = await PoolLogic.connect(owner).deploy();
    let ct = await poolLogic.deployed();

    const PersonalPoolLogic = await ethers.getContractFactory("PersonalPoolLogic");
    const personalPoolLogic = await PersonalPoolLogic.connect(owner).deploy();
    ct = await personalPoolLogic.deployed();

    const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
    const factoryLogic = await FactoryLogic.connect(owner).deploy();
    ct = await factoryLogic.deployed();

    await ct.deployTransaction.wait();

    const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
    poolLibrary = await PoolLibrary.deploy();

    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    lendBorrowLibrary = await LendBorrowLibrary.deploy();

    const LiquidityProvisionLibrary = await ethers.getContractFactory("LiquidityProvisionLibrary");
    liquidityProvisionLibrary = await LiquidityProvisionLibrary.deploy();

    await lendBorrowLibrary.deployed();

    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();

    const factoryParam = {
      fee: fee,
      treasuryFund: owner.address,
      storageContract: storageContract,
      dexConvert: dexConvertLibrary,
      dexEstimate: dexEstimateLibrary,
      poolLogic: poolLogic.address,
      poolLibrary: poolLibrary.address,
      liquidityProvisionLibrary: liquidityProvisionLibrary.address,
      personalPoolLogic: personalPoolLogic.address,
     
      lendBorrowLibrary: lendBorrowLibrary.address,
      futuresLibrary: futuresLibrary.address,
      networkNativeToken: cakeAddress,
      uniswapV2In: uniswapV2In,
      uniswapV2Out: uniswapV2Out,
      venusContract: venusContract,
      horizonProtocolLib: horizonProtocolLib,
      whitelistedAssets: [
        ethers.constants.AddressZero,
        busd.address,
        usdc.address,
        cakeAddress,
        wBNB,
      ],
      whitelistedPlatforms: [
        lendBorrowLibrary.address,
        futuresLibrary.address,
        poolLibrary.address,
        dexConvertLibrary,
        dexEstimateLibrary,
        uniswapV2In,
        horizonProtocolLib,
        venusContract,
        liquidityProvisionLibrary.address,
      ],
      baseUri: baseURI,
    };

    const bytecode = FactoryLogic.interface.encodeFunctionData("initialize", [
      factoryParam,
    ]);

    const FactoryProxy = await ethers.getContractFactory("FactoryProxy");
    const factoryProxy = await FactoryProxy.connect(owner).deploy(
      factoryLogic.address,
      bytecode
    );
    ct = await factoryProxy.deployed();

    tx = await ct.deployTransaction.wait();

    factoryProxied = await FactoryLogic.attach(factoryProxy.address);

    const Convert = await ethers.getContractFactory("Convert");
    convertContract = await Convert.connect(owner).deploy(
      factoryProxied.address
    );
    await convertContract.deployed();
   
  });
  describe("Create pool", function () {
    it("Success: create pool", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        frequency: 0,
        feePercentage: "10000",
        name: "Test Pool",
        symbol: "TPL",
        feeCollector: poolManager.address,
        supportedAssets: [
          ethers.constants.AddressZero,
          busd.address,
          usdc.address,
          cakeAddress,
          wBNB,
        ],
        supportedPlatforms: [
          lendBorrowLibrary.address,
          futuresLibrary.address,
          poolLibrary.address,
          dexConvertLibrary,
          dexEstimateLibrary,
          uniswapV2In,
          horizonProtocolLib,
          venusContract,
          liquidityProvisionLibrary.address,
        ],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: "1",
        minInvestmentAmount: "0",
        maxInvestmentAmount: "0",
        entryFee: {
          isFixedAmount: false,
          feeAmount: 0
        },
        exitFee: {
          isFixedAmount: false,
          feeAmount: 0
        },
        autoSwap: {
          isAutoSwapOn: false,
          autoSwapToken: ethers.constants.AddressZero
        }
      };
      console.log(poolParams)

      let tx = await factoryProxied.connect(poolManager).createPool(poolParams);
      await tx.wait();
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      poolContract = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[0]
      );

      tx = await convertContract
        .connect(owner)
        .convert(
          [ethers.constants.AddressZero],
          [ethers.utils.parseUnits("1", "ether")],
          busdAddress,
          { value: ethers.utils.parseUnits("1", "ether") }
        );
      await tx.wait();

      tx = await convertContract
        .connect(user)
        .convert(
          [ethers.constants.AddressZero],
          [ethers.utils.parseUnits("20", "ether")],
          usdcAddress,
          { value: ethers.utils.parseUnits("20", "ether") }
        );
      await tx.wait();
    });
  });
  describe("Get balance per asset", function () {
    it("Success: asset type - ERC20", async function () {
      let tx = await busd
        .connect(owner)
        .approve(poolContract.address, ethers.utils.parseUnits("150", "ether"));
      await tx.wait();

      tx = await poolContract
        .connect(owner)
        .invest(busd.address, ethers.utils.parseEther("150"), {
          gasLimit: 1000000,
        });
      await tx.wait();

      console.log(
        "OWNER",
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset : ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset(
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
          )
      );

      tx = await usdc
        .connect(user)
        .approve(poolContract.address, ethers.utils.parseUnits("150", "ether"));
      await tx.wait();
      tx = await poolContract
        .connect(user)
        .invest(usdc.address, ethers.utils.parseEther("150"), {
          gasLimit: 1000000,
        });
      await tx.wait();

      console.log(
        "USER",
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset : ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset(
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
          )
      );
    });

    it("Success: asset type - LPTOKEN", async function () {
      const iface = new ethers.utils.Interface([
        "function enter(address,address,(address,address,uint256,uint256,address,(address,address,address[],address[][])[]))",
      ]);
      const data = iface.encodeFunctionData("enter", [
        factoryProxied.address,
        poolContract.address,
        Object.values({
            fromToken: usdc.address,
            pairAddress: pairAddress,
            amount: ethers.utils.parseEther("90"),
            minReceiveAmount: "1",
            exchangeRouterAddress: routerAddress,
            swapOptions: []
        })
      ]);


      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();

      console.log(
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset: ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset(
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
          )
      );
    });
    it("Success: asset type - FUTURE", async function () {
      let tx = await poolContract
        .connect(owner)
        .invest(  ethers.constants.AddressZero, ethers.utils.parseEther("1"), {
          gasLimit: 1000000, value: ethers.utils.parseEther("1")
        });
      await tx.wait();
      const iface = new ethers.utils.Interface([
        "function placeMarketOrder(address,uint8,uint8,uint8,address,address,bytes,uint256)",
      ]);

      const hashedData =
        "0x00000000000000000000000000000000000000000000000000011ab07a77e4f6000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000398dd06d5c800000000000000000000000000000000000000002735e3b44736133d2f0cdd5e5c000000000000000000000000000000000000000000000000000398dd06d5c800000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";

      const data = iface.encodeFunctionData("placeMarketOrder", [
        poolContract.address,
        0,
        0,
        0,
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        hashedData,
        ethers.utils.parseEther("0.0197"),
      ]);

      tx = await poolContract
        .connect(poolManager)
        .libraryCall(futuresLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();

      console.log(
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset: ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset( 
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
        ),
        "Balance per asset futures: ",
        await poolLibrary.getFuturesToToken( 
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
        ),

      );
    });
  });
 
  describe("Venus lend and borrow", function () {
    let vAmount;
    let vAmountBorrow;
    it("Success: asset type - LEND", async function () {
      console.log(await usdc.balanceOf(poolContract.address));

      const iface = new ethers.utils.Interface([
        "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusDeposit", [
        factoryProxied.address,
        poolContract.address,
        vBNB,
        ethers.utils.parseEther("0.1"),
      ]);

      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000});
      await tx.wait();
      console.log(
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset: ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset(
        factoryProxied.address,
        poolContract.address,
        ethers.constants.AddressZero
      ))
      vAmount = await convertContract.getVBalance(vUSDC, poolContract.address);
    });

    it("Success: asset type - BORROW", async function () {
      const iface = new ethers.utils.Interface([
        "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusBorrow", [
        factoryProxied.address,
        poolContract.address,
        vUSDC,
        ethers.utils.parseEther("2"),
      ]);
    
      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000});
      await tx.wait();
     
      console.log(
        "Balance per pool: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        ),
        "Balance per asset: ",
        await poolLibrary.getAssetAndBlockedAmountsToTokenPerAsset( 
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
          )
      );
    });
  });
});