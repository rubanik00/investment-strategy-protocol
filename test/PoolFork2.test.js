// const { assert, expect } = require("chai");
// const { ethers } = require("hardhat");

// describe("PoolFork", function () {
//   let accounts;
//   let owner;
//   let user;
//   let poolManager;
//   let factoryProxied;
//   let platform1, platform2;
//   let poolContract;
//   let convertContract;
//   const fee = 10000; // = 10%
//   const lockPeriodInSec = 1;
//   const baseURI = "https://goerli.infura.io/v3/";
//   const storageContract = process.env.EXCHANGE_STORAGE_CONTRACT;
//   const dexConvertLibrary = process.env.DEX_CONVERT_CONTRACT;
//   const dexEstimateLibrary = process.env.DEX_ESTIMATE_CONTRACT;
//   const venusContract = process.env.VENUS;
//   const horizonProtocolLib = process.env.HORIZON;
//   const cakeAddress = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";
//   const usdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
//   const busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
//   const uniswapV2In = "0xA961f342439Cc9296cD4A638e0fb893E8c350237";
//   const uniswapV2Out = "0xFaD13EBaB3086b04da129AD1636063E78B5CC20f";
//   const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
//   const routerAddress2 = "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607";
//   const pairAddress = "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE";
//   const pairAddress2 = "0x7EFaEf62fDdCCa950418312c6C91Aef321375A00";
//   const vBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
//   const vUSDC = "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8";
//   const vCAKE = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";
//   let busd, usdc;
//   let pairContract;
//   let pairContract2;
//   let lpAmount;
//   let poolLibrary;
//   let lendBorrowLibrary;
//   let futuresLibrary;
//   let vUsdc;

//   const risk = 10;

//   before("setup others", async function () {
//     accounts = await ethers.getSigners();
//     owner = accounts[0];
//     user = accounts[1];
//     poolManager = accounts[2];
//     platform1 = accounts[3];
//     platform2 = accounts[4];

//     busd = await ethers.getContractAt("IERC20", busdAddress);
//     usdc = await ethers.getContractAt("IERC20", usdcAddress);
//     vUsdc = await ethers.getContractAt("IERC20", vUSDC);
//     pairContract = await ethers.getContractAt("IERC20", pairAddress);
//     pairContract2 = await ethers.getContractAt("IERC20", pairAddress2);
//     dexEstimateContract = await ethers.getContractAt(
//       "IDexEstimateLibrary",
//       dexEstimateLibrary
//     );

//     const PoolLogic = await ethers.getContractFactory("PoolLogic");
//     const poolLogic = await PoolLogic.connect(owner).deploy();
//     let ct = await poolLogic.deployed();

//     const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
//     const factoryLogic = await FactoryLogic.connect(owner).deploy();
//     ct = await factoryLogic.deployed();

//     await ct.deployTransaction.wait();

//     const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
//     poolLibrary = await PoolLibrary.deploy();

//     const LendBorrowLibrary = await ethers.getContractFactory(
//       "LendBorrowLibrary"
//     );
//     lendBorrowLibrary = await LendBorrowLibrary.deploy();

//     const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
//     futuresLibrary = await FuturesLibrary.deploy();

//     const factoryParam = {
//       fee: fee,
//       treasuryFund: owner.address,
//       storageContract: storageContract,
//       dexConvert: dexConvertLibrary,
//       dexEstimate: dexEstimateLibrary,
//       poolLogic: poolLogic.address,
//       poolLibrary: poolLibrary.address,
//       lendBorrowLibrary: lendBorrowLibrary.address,
//       futuresLibrary: futuresLibrary.address,
//       networkNativeToken: cakeAddress,
//       uniswapV2In: uniswapV2In,
//       uniswapV2Out: uniswapV2Out,
//       venusContract: venusContract,
//       horizonProtocolLib: horizonProtocolLib,
//       whitelistedAssets: [
//         ethers.constants.AddressZero,
//         busd.address,
//         usdc.address,
//         cakeAddress,
//       ],
//       whitelistedPlatforms: [platform1.address, platform2.address],
//       baseUri: baseURI,
//     };

//     const bytecode = FactoryLogic.interface.encodeFunctionData("initialize", [
//       factoryParam,
//     ]);

//     const FactoryProxy = await ethers.getContractFactory("FactoryProxy");
//     const factoryProxy = await FactoryProxy.connect(owner).deploy(
//       factoryLogic.address,
//       bytecode
//     );
//     ct = await factoryProxy.deployed();

//     tx = await ct.deployTransaction.wait();

//     factoryProxied = await FactoryLogic.attach(factoryProxy.address);

//     const Convert = await ethers.getContractFactory("Convert");
//     convertContract = await Convert.connect(owner).deploy(
//       factoryProxied.address
//     );
//     await convertContract.deployed();
//   });
//   describe("Create pool", function () {
//     it("Success: create pool with 2 assets and 1 platform", async function () {
//       const poolParams = {
//         privacyStatus: false,
//         published: true,
//         lockPeriodInSec: lockPeriodInSec,
//         feePercentage: 10000,
//         name: "Test Pool",
//         symbol: "TPL",
//         feeCollector: poolManager.address,
//         supportedAssets: [
//           ethers.constants.AddressZero,
//           busd.address,
//           usdc.address,
//           cakeAddress,
//         ],
//         supportedPlatforms: [platform1.address],
//         whitelistedUsers: [],
//         risk: risk,
//         minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
//       };

//       let tx = await factoryProxied.connect(poolManager).createPool(poolParams);
//       await tx.wait();
//       const poolAddressesArray = await factoryProxied.getPoolAddresses();
//       poolContract = await ethers.getContractAt(
//         "PoolLogic",
//         poolAddressesArray[0]
//       );

//       tx = await convertContract
//         .connect(owner)
//         .convert(
//           [ethers.constants.AddressZero],
//           [ethers.utils.parseUnits("1", "ether")],
//           busdAddress,
//           { value: ethers.utils.parseUnits("1", "ether") }
//         );
//       await tx.wait();

//       tx = await convertContract
//         .connect(user)
//         .convert(
//           [ethers.constants.AddressZero],
//           [ethers.utils.parseUnits("20", "ether")],
//           usdcAddress,
//           { value: ethers.utils.parseUnits("20", "ether") }
//         );
//       await tx.wait();
//     });
//   });
//   describe("Invest to pool", function () {
//     it("Success: invest BNB in pool by user", async function () {
//       console.log(
//         "LP balance user",
//         await poolContract.balanceOf(user.address)
//       );
//       let tx = await poolContract
//         .connect(user)
//         .invest(
//           ethers.constants.AddressZero,
//           ethers.utils.parseEther("0.0005"),
//           {
//             gasLimit: 1000000,
//             value: ethers.utils.parseEther("0.0005"),
//           }
//         );
//       await tx.wait();
//       console.log(
//         "LP balance user",
//         await poolContract.balanceOf(user.address)
//       );
//     });

//     it("Success: lend by manager vBNB", async function () {
//       const iface = new ethers.utils.Interface([
//         "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
//       ]);

//       const data = iface.encodeFunctionData("venusDeposit", [
//         factoryProxied.address,
//         poolContract.address,
//         vBNB,
//         ethers.utils.parseEther("0.0005"),
//       ]);

//       const tx = await poolContract
//         .connect(poolManager)
//         .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
//       await tx.wait();
//       vAmount = await convertContract.getVBalance(vBNB, poolContract.address);
//       console.log("Deposited amt ", vAmount);
//     });

//     it("Success: invest in pool by user 2", async function () {
//       let tx = await usdc
//         .connect(user)
//         .approve(poolContract.address, ethers.utils.parseUnits("1", "ether"));
//       await tx.wait();

//       console.log(
//         "ESTIMATE",
//         await poolLibrary.estimateLpAmount(
//           factoryProxied.address,
//           poolContract.address,
//           usdc.address,
//           ethers.utils.parseEther("1"),
//           true
//         )
//       );
//       tx = await poolContract
//         .connect(user)
//         .invest(usdc.address, ethers.utils.parseEther("1"), {
//           gasLimit: 1000000,
//         });
//       await tx.wait();
//       console.log("USDT balance user", await usdc.balanceOf(user.address));
//       console.log(
//         "Pool LP balance user",
//         await poolContract.balanceOf(user.address)
//       );
//       const res = await poolContract.analytics(ethers.constants.AddressZero);
//       console.log(res.investedInUSD, "+- 300$");
//     });
//   });
// });
