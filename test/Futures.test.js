// const { assert, expect } = require("chai");
// const { ethers } = require("hardhat");

// describe("Futures Test", function () {
//   let accounts;
//   let owner;
//   let user;
//   let poolManager;
//   let factoryProxied;
//   let platform1, platform2;
//   let poolContract;
//   const risk = 10;
//   const fee = 10000; // = 10%
//   const lockPeriodInSec = 1;
//   const baseURI = "https://goerli.infura.io/v3/";
//   const storageContract = "0x5B429D52389C496ba339b9f0135A26633bf99989";
//   const dexConvertLibrary = "0x821117bC90E7D8C1AE3703AC16E27dCbEA1BF23A";
//   const dexEstimateLibrary = "0xd7b4F951A356E259067152347801e62288608024";
//   const venusContract = "0x2029a1588f6DDC0bF481F6534e3C0B0D0D8Ae769";
//   const horizonProtocolLib = "0xf475c60b316af2e8f9c2fe88f25d488a55619150";
//   const cakeAddress = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";
//   const uniswapV2In = "0xA961f342439Cc9296cD4A638e0fb893E8c350237";
//   const uniswapV2Out = "0xFaD13EBaB3086b04da129AD1636063E78B5CC20f";
//   const wbnb = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
//   const eth = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
//   const fakeEthHolder = "0x34ea4138580435B5A521E460035edb19Df1938c1";
//   let poolLibrary;
//   let lendBorrowLibrary;
//   let futuresLibrary;

//   before("setup others", async function () {
//     accounts = await ethers.getSigners();
//     owner = accounts[0];
//     user = accounts[1];
//     poolManager = accounts[2];
//     platform1 = accounts[3];
//     platform2 = accounts[4];

//     testEth = await ethers.getContractAt("IERC20", eth);

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
//       whitelistedAssets: [ethers.constants.AddressZero, cakeAddress, wbnb, eth],
//       whitelistedPlatforms: [futuresLibrary.address],
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
//         supportedAssets: [ethers.constants.AddressZero, cakeAddress, wbnb, eth],
//         supportedPlatforms: [futuresLibrary.address],
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
//         .invest(ethers.constants.AddressZero, ethers.utils.parseEther("1"), {
//           gasLimit: 1000000,
//           value: ethers.utils.parseEther("1"),
//         });
//       await tx.wait();
//       console.log(
//         "LP balance user",
//         await poolContract.balanceOf(user.address)
//       );
//     });
//   });

//   describe("Futures test", function () {
//     it("Success: placeMarketOrder (BNB) by poolManager", async function () {
//       const iface = new ethers.utils.Interface([
//         "function placeMarketOrder(address,uint8,uint8,uint8,address,address,bytes,uint256)",
//       ]);

//       const hashedData =
//         "0x00000000000000000000000000000000000000000000000000011ab07a77e4f6000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000398dd06d5c800000000000000000000000000000000000000002735e3b44736133d2f0cdd5e5c000000000000000000000000000000000000000000000000000398dd06d5c800000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";

//       const data = iface.encodeFunctionData("placeMarketOrder", [
//         poolContract.address,
//         0,
//         0,
//         0,
//         "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
//         "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
//         hashedData,
//         ethers.utils.parseEther("0.0197"),
//       ]);

//       const tx = await poolContract
//         .connect(poolManager)
//         .libraryCall(futuresLibrary.address, data, { gasLimit: 5000000 });
//       await tx.wait();
//     });
//     it("Success: placeMarketOrder (ETH) by poolManager", async function () {
//       const rawTx = await testEth.populateTransaction.transfer(
//         poolContract.address,
//         ethers.utils.parseEther("100")
//       );

//       await network.provider.send("eth_sendTransaction", [
//         { from: fakeEthHolder, to: testEth.address, data: rawTx.data },
//       ]);

//       expect(await testEth.balanceOf(poolContract.address)).to.be.equal(
//         ethers.utils.parseEther("100")
//       );

//       const iface = new ethers.utils.Interface([
//         "function placeMarketOrder(address,uint8,uint8,uint8,address,address,bytes,uint256)",
//       ]);

//       const hashedData =
//         "0x00000000000000000000000000000000000000000000000000011d40618cf2e20000000000000000000000002170ed0880ac9a755fd29b2688956bd959f933f8000000000000000000000000000000000000000000000000000e35fa931a000000000000000000000000000000000000000004978bae418f13970a410b78f5d000000000000000000000000000000000000000000000000000525a34905eb70500000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";

//       const data = iface.encodeFunctionData("placeMarketOrder", [
//         poolContract.address,
//         0,
//         0,
//         0,
//         "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
//         "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
//         hashedData,
//         ethers.utils.parseEther("0.005"),
//       ]);

//       const tx = await poolContract
//         .connect(poolManager)
//         .libraryCall(futuresLibrary.address, data, { gasLimit: 5000000 });
//       await tx.wait();
//     });
//   });
// });
