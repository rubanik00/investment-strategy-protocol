// const { assert } = require("chai");
// const { ethers } = require("hardhat");

// describe("GetPools stress test", function () {
//   const baseURI = "https://goerli.infura.io/v3/";
//   let accounts;
//   let owner;
//   let user;
//   let wBNB;
//   let factoryProxied, factoryProxied2;
//   let erc20_1, erc20_2, erc20_3;
//   let platform1, platform2, platform3;
//   let dexEstimateLibrary, dexConvertLibrary;
//   let storageContract;
//   const fee = 10000; // = 10%

//   const metadata = ethers.utils.formatBytes32String("Sample metadata"); // TODO: TBC metadata format for tests
//   const risk = 10;
//   const lockPeriodInSec = 3600;

//   before("setup others", async function () {
//     await ethers.provider.send("hardhat_reset");

//     accounts = await ethers.getSigners();
//     owner = accounts[0];
//     user = accounts[1];
//     wBNB = accounts[2];
//     platform1 = accounts[3];
//     platform2 = accounts[4];
//     platform3 = accounts[5];
//     storageContract = accounts[6];
//     feeCollector = accounts[7];

//     const ERC20 = await ethers.getContractFactory("TestToken20");

//     erc20_1 = await ERC20.connect(owner).deploy(
//       ethers.utils.parseUnits("100", "ether"),
//       "Test1",
//       "TST1"
//     );
//     await erc20_1.deployed();

//     erc20_2 = await ERC20.connect(owner).deploy(
//       ethers.utils.parseUnits("100", "ether"),
//       "Test2",
//       "TST2"
//     );
//     await erc20_2.deployed();

//     erc20_3 = await ERC20.connect(owner).deploy(
//       ethers.utils.parseUnits("100", "ether"),
//       "Test3",
//       "TST3"
//     );
//     await erc20_3.deployed();

//     const PoolLogic = await ethers.getContractFactory("PoolLogic");
//     const poolLogic = await PoolLogic.connect(owner).deploy();
//     let ct = await poolLogic.deployed();

//     let tx = await ct.deployTransaction.wait();

//     const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
//     const factoryLogic = await FactoryLogic.connect(owner).deploy();
//     ct = await factoryLogic.deployed();

//     tx = await ct.deployTransaction.wait();

//     const DexEstimateLibrary = await ethers.getContractFactory(
//       "DexEstimateLibrary"
//     );
//     dexEstimateLibrary = await DexEstimateLibrary.connect(owner).deploy();
//     await dexEstimateLibrary.deployed();

//     const DexConvertLibrary = await ethers.getContractFactory(
//       "DexConvertLibrary"
//     );
//     dexConvertLibrary = await DexConvertLibrary.connect(owner).deploy();
//     await dexConvertLibrary.deployed();

//     const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
//     const poolLibrary = await PoolLibrary.deploy();

//     const factoryParam = {
//       fee: fee,
//       treasuryFund: owner.address,
//       storageContract: storageContract.address,
//       dexConvert: dexConvertLibrary.address,
//       dexEstimate: dexEstimateLibrary.address,
//       poolLogic: poolLogic.address,
//       poolLibrary: poolLibrary.address,
//       networkNativeToken: wBNB.address,
//       uniswapV2In: owner.address,
//       uniswapV2Out: owner.address,
//       whitelistedAssets: [erc20_1.address, erc20_2.address],
//       whitelistedPlatforms: [platform1.address, platform2.address],
//       baseUri: baseURI,
//     };

//     const bytecode2 = FactoryLogic.interface.encodeFunctionData("initialize", [
//       factoryParam,
//     ]);

//     const FactoryProxy = await ethers.getContractFactory("FactoryProxy");
//     const factoryProxy = await FactoryProxy.connect(owner).deploy(
//       factoryLogic.address,
//       bytecode2
//     );
//     await factoryProxy.deployed();

//     const factoryProxy2 = await FactoryProxy.connect(owner).deploy(
//       factoryLogic.address,
//       bytecode2
//     );
//     await factoryProxy2.deployed();

//     factoryProxied = await FactoryLogic.attach(factoryProxy.address);
//     factoryProxied2 = await FactoryLogic.attach(factoryProxy2.address);
//   });

//   describe("Stress test", function () {
//     it("Success: get (max) pools and call factory.getPools", async function () {
//       const callArr = [];

//       for (let i = 0; i < 1500; i++) {
//         const poolParams = {
//           privacyStatus: false,
//           published: true,
//           lockPeriodInSec: lockPeriodInSec,
//           feePercentage: 10000,
//           name: `Test Pool ${i}`,
//           symbol: `TPL${i}`,
//           feeCollector: feeCollector.address,
//           supportedAssets: [erc20_1.address],
//           supportedPlatforms: [platform1.address],
//           whitelistedUsers: [],
//           metadata: metadata,
//           risk: risk,
//           minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
//         };

//         callArr.push(factoryProxied.connect(user).createPool(poolParams));
//       }
//       await Promise.all(callArr);
//       console.log("Pools created.");

//       const res = await factoryProxied.getPools(5, 762);
//       assert.equal(res.length, 762);
//     });

//     it("Fail: get 763(more than possible) pools and try to call factory.getPools", async function () {
//       const callArr = [];

//       for (let i = 0; i < 1500; i++) {
//         const poolParams = {
//           privacyStatus: false,
//           published: true,
//           lockPeriodInSec: lockPeriodInSec,
//           feePercentage: 10000,
//           name: `Test Pool ${i}`,
//           symbol: `TPL${i}`,
//           feeCollector: feeCollector.address,
//           supportedAssets: [erc20_1.address],
//           supportedPlatforms: [platform1.address],
//           whitelistedUsers: [],
//           metadata: metadata,
//           risk: risk,
//           minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
//         };

//         callArr.push(factoryProxied.connect(user).createPool(poolParams));
//       }
//       await Promise.all(callArr);
//       console.log("Pools created.");
//       try {
//         await factoryProxied.getPools(5, 763);
//       } catch (e) {
//         console.log(e);
//       }
//     });
//     it("Fail: call outside array", async function () {
//       try {
//         await factoryProxied.getPools(2800, 400);
//       } catch (e) {
//         console.log(e);
//       }
//     });
//   });
// });
