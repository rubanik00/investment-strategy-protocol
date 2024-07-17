const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("Factory", function () {
  const baseURI = "https://goerli.infura.io/v3/";
  let accounts;
  let owner;
  let user, user2;
  let poolManager;
  let factoryProxied;
  let erc20_1, erc20_2, erc20_3, erc20_4, erc20_5;
  let wBNB;
  let platform1, platform2, platform3, platform4, platform5;
  let dexEstimateLibrary, dexConvertLibrary;
  let storageContract;
  let feeCollector;
  let futuresLibrary;
  let liquidityProvisionLibrary;

  const risk = 10;
  const lockPeriodInSec = 3600;
  const fee = 10000; // = 10%

  before("setup others", async function () {
    await ethers.provider.send("hardhat_reset");

    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    poolManager = accounts[2];
    platform1 = accounts[3];
    platform2 = accounts[4];
    platform3 = accounts[5];
    platform4 = accounts[6];
    platform5 = accounts[7];
    storageContract = accounts[8];
    feeCollector = accounts[9];
    user2 = accounts[10];

    const ERC20 = await ethers.getContractFactory("TestToken20");

    erc20_1 = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "Test1",
      "TST1"
    );
    await erc20_1.deployed();

    erc20_2 = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "Test2",
      "TST2"
    );
    await erc20_2.deployed();

    erc20_3 = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "Test3",
      "TST3"
    );
    await erc20_3.deployed();

    erc20_4 = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "Test4",
      "TST4"
    );
    await erc20_4.deployed();

    erc20_5 = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "Test5",
      "TST5"
    );
    await erc20_5.deployed();

    wBNB = await ERC20.connect(owner).deploy(
      ethers.utils.parseUnits("100", "ether"),
      "WrappedBNB",
      "WBNB"
    );
    await wBNB.deployed();

    const PoolLogic = await ethers.getContractFactory("PoolLogic");
    const poolLogic = await PoolLogic.connect(owner).deploy();
    let ct = await poolLogic.deployed();

    const PersonalPoolLogic = await ethers.getContractFactory("PersonalPoolLogic");
    const personalPoolLogic = await PersonalPoolLogic.connect(owner).deploy();
    ct = await personalPoolLogic.deployed();

    const LiquidityProvisionLibrary = await ethers.getContractFactory("LiquidityProvisionLibrary");
    liquidityProvisionLibrary = await LiquidityProvisionLibrary.deploy();

    let tx = await ct.deployTransaction.wait();

    console.log("Gas Used (deploy): ", tx.gasUsed.toString());

    const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
    const factoryLogic = await FactoryLogic.connect(owner).deploy();
    ct = await factoryLogic.deployed();

    tx = await ct.deployTransaction.wait();

    console.log("Gas Used (deploy): ", tx.gasUsed.toString());

    const DexEstimateLibrary = await ethers.getContractFactory(
      "DexEstimateLibrary"
    );
    dexEstimateLibrary = await DexEstimateLibrary.connect(owner).deploy();
    await dexEstimateLibrary.deployed();

    const DexConvertLibrary = await ethers.getContractFactory(
      "DexConvertLibrary"
    );
    dexConvertLibrary = await DexConvertLibrary.connect(owner).deploy();
    await dexConvertLibrary.deployed();

    const PoolLibrary = await ethers.getContractFactory("PoolLibrary");
    const poolLibrary = await PoolLibrary.deploy();

    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    const lendBorrowLibrary = await LendBorrowLibrary.deploy();

    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();

    const factoryParam = {
      fee: fee,
      treasuryFund: owner.address,
      storageContract: storageContract.address,
      dexConvert: dexConvertLibrary.address,
      dexEstimate: dexEstimateLibrary.address,
      poolLogic: poolLogic.address,
      liquidityProvisionLibrary: liquidityProvisionLibrary.address,
      personalPoolLogic: personalPoolLogic.address,
      poolLibrary: poolLibrary.address,
      lendBorrowLibrary: lendBorrowLibrary.address,
      futuresLibrary: futuresLibrary.address,
      networkNativeToken: wBNB.address,
      uniswapV2In: owner.address,
      uniswapV2Out: owner.address,
      venusContract: ethers.constants.AddressZero,
      horizonProtocolLib: ethers.constants.AddressZero,
      whitelistedAssets: [erc20_1.address, erc20_2.address],
      whitelistedPlatforms: [platform1.address, platform2.address],
      baseUri: baseURI,
    };

    const bytecode2 = FactoryLogic.interface.encodeFunctionData("initialize", [
      factoryParam,
    ]);

    const FactoryProxy = await ethers.getContractFactory("FactoryProxy");
    const factoryProxy = await FactoryProxy.connect(owner).deploy(
      factoryLogic.address,
      bytecode2
    );
    ct = await factoryProxy.deployed();

    tx = await ct.deployTransaction.wait();

    console.log("Gas Used (deploy): ", tx.gasUsed.toString());

    factoryProxied = await FactoryLogic.attach(factoryProxy.address);
  });
  describe("Create pool", function () {
    it("Success: create pool with 1 asset and 1 platform", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        feePercentage: 10000,
        frequency: 60 * 60 * 24 * 7, // 7 days
        name: "Test Pool",
        symbol: "TPL",
        feeCollector: feeCollector.address,
        supportedAssets: [erc20_1.address],
        supportedPlatforms: [platform1.address],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

      const tx = await factoryProxied
        .connect(poolManager)
        .createPool(poolParams);

      const require = await tx.wait();
      const poolAddress = require.events[2].args[0];
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      assert.equal(poolAddressesArray[0], poolAddress);
    });
    it("Fail: create pool with 2 assets and 2 platforms with not whitelisted asset", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        feePercentage: 10000,
        frequency: 60 * 60 * 24 * 7, // 7 days
        name: "Test Pool 2",
        symbol: "TPL2",
        feeCollector: feeCollector.address,
        supportedAssets: [erc20_1.address, erc20_2.address, erc20_3.address],
        supportedPlatforms: [
          platform1.address,
          platform2.address,
          platform3.address,
        ],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

      await expect(
        factoryProxied.connect(user).createPool(poolParams)
      ).to.be.revertedWith("TokenIsNotInTheWhitelist");
    });
  });

  describe("Add and Remove assets and platform to whitelist", function () {
    describe("Add assets and platform to whitelist", function () {
      it("Fail: add asset to whitelist by user", async function () {
        await expect(
          factoryProxied
            .connect(user)
            .manageAssetsToWhitelist([erc20_3.address, erc20_4.address], true)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("Success: add asset to whitelist by owner", async function () {
        await factoryProxied
          .connect(owner)
          .manageAssetsToWhitelist([erc20_3.address, erc20_4.address], true);
        const assets = await factoryProxied.getWhitelistedAssets();
        assert.equal(assets[3], erc20_4.address);
      });

      it("Fail: create pool with 2 assets and 2 platforms with not whitelisted platform", async function () {
        const poolParams = {
          privacyStatus: false,
          published: true,
          lockPeriodInSec: lockPeriodInSec,
          feePercentage: 10000,
          frequency: 60 * 60 * 24 * 7, // 7 days
          name: "Test Pool 2",
          symbol: "TPL2",
          feeCollector: feeCollector.address,
          supportedAssets: [erc20_1.address, erc20_2.address, erc20_3.address],
          supportedPlatforms: [
            platform1.address,
            platform2.address,
            platform3.address,
          ],
          whitelistedUsers: [],
          redemptionSupportedAssets: [],
          risk: risk,
          minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
          maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

        await expect(
          factoryProxied.connect(user).createPool(poolParams)
        ).to.be.revertedWith("PlatformIsNotInTheWhitelist");
      });
      it("Success: add platform to whitelist by owner", async function () {
        await factoryProxied
          .connect(owner)
          .managePlatformsToWhitelist([platform3.address], true);
        const platforms = await factoryProxied.getWhitelistedPlatforms();
        assert.equal(platforms[2], platform3.address);
      });
      it("Success: add platform to whitelist by owner", async function () {
        await factoryProxied
          .connect(owner)
          .managePlatformsToWhitelist([platform4.address], true);
        const platforms = await factoryProxied.getWhitelistedPlatforms();
        assert.equal(platforms[3], platform4.address);
      });
    });
    describe("Remove assets and platform to whitelist", function () {
      it("Success: remove platform to whitelist by owner", async function () {
        await factoryProxied
          .connect(owner)
          .managePlatformsToWhitelist([platform4.address], false);
        const platforms = await factoryProxied.getWhitelistedPlatforms();
        assert.equal(platforms.length, 3);
      });
      it("Success: remove assets to whitelist by owner", async function () {
        await factoryProxied
          .connect(owner)
          .manageAssetsToWhitelist([erc20_4.address], false);
        const assets = await factoryProxied.getWhitelistedAssets();
        assert.equal(assets.length, 3);
      });
    });
  });

  describe("Create pool again", function () {
    it("Success: create pool with 2 assets and 2 platforms", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        feePercentage: 10000,
        frequency: 60 * 60 * 24 * 7, // 7 days
        name: "Test Pool 2",
        symbol: "TPL2",
        feeCollector: feeCollector.address,
        supportedAssets: [erc20_1.address, erc20_2.address, erc20_3.address],
        supportedPlatforms: [
          platform1.address,
          platform2.address,
          platform3.address,
        ],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

      const tx = await factoryProxied.connect(user).createPool(poolParams);

      const require = await tx.wait();
      const poolAddress = require.events[2].args[0];
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      assert.equal(poolAddressesArray[1], poolAddress);
    });

    it("Success: create pool with 3 assets and 3 platforms", async function () {
      const poolParams = {
        privacyStatus: true,
        published: false,
        lockPeriodInSec: lockPeriodInSec,
        feePercentage: 10000,
        frequency: 60 * 60 * 24 * 7, // 7 days
        name: "Test Pool 3",
        symbol: "TPL3",
        feeCollector: feeCollector.address,
        supportedAssets: [erc20_1.address, erc20_2.address],
        supportedPlatforms: [platform1.address, platform2.address],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

      const tx = await factoryProxied.connect(user2).createPool(poolParams);

      const require = await tx.wait();
      const poolAddress = require.events[2].args[0];
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      assert.equal(poolAddressesArray[2], poolAddress);
    });
  });
  describe("Get Pools method", function () {
    it("Success: mint tokens for assets", async function () {
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      for (let i = 0; i < poolAddressesArray.length; i++) {
        let tx = await erc20_1.mint(
          poolAddressesArray[i],
          ethers.utils.parseUnits(`10${i}`, "ether")
        );
        await tx.wait();

        tx = await erc20_2.mint(
          poolAddressesArray[i],
          ethers.utils.parseUnits(`10${i}`, "ether")
        );
        await tx.wait();

        tx = await erc20_3.mint(
          poolAddressesArray[i],
          ethers.utils.parseUnits(`10${i}`, "ether")
        );
        await tx.wait();
      }
    });

    it("Success: getPools", async function () {
      const pools = await factoryProxied.connect(user).getPools(0, 3);
      console.log(pools);
      assert.equal(
        pools[1].assetsBalances[1].balance.toString(),
        "101000000000000000000"
      );
    });

    it("Success: getPools", async function () {
      const pools = await factoryProxied.connect(user2).getPools(0, 3);
      console.log(pools);
      assert.equal(
        pools[2].assetsBalances[1].balance.toString(),
        "102000000000000000000"
      );
    });

    it("Success: set publish status", async function () {
      let pools = await factoryProxied.connect(owner).getPools(0, 3);
      try {
        console.log(pools[2].assetsBalances[1].balance.toString());
      } catch (e) {
        console.log(e);
      }

      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      const pool = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[2]
      );
      await pool.connect(user2).setPublishStatus(true);
      pools = await factoryProxied.connect(owner).getPools(0, 3);
      assert.equal(
        pools[2].assetsBalances[1].balance.toString(),
        "102000000000000000000"
      );
    });
  });
  describe("Create private pool", function () {
    it("Success: create private pool with 1 asset and 1 platform", async function () {
      const poolParams = {
        privacyStatus: true,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        feePercentage: 10000,
        frequency: 60 * 60 * 24 * 7, // 7 days
        name: "Test Pool Private",
        symbol: "TPL_P",
        feeCollector: feeCollector.address,
        supportedAssets: [erc20_1.address],
        supportedPlatforms: [platform1.address],
        whitelistedUsers: [user2.address, owner.address],
        redemptionSupportedAssets: [],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("100", "ether"),
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

      const tx = await factoryProxied.connect(user2).createPool(poolParams);

      const require = await tx.wait();
      const poolAddress = require.events[2].args[0];
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      assert.equal(poolAddressesArray[3], poolAddress);
    });
  });
  describe("Add and Remove investors in private pool", function () {
    it("Fail: add new investor by not owner of pool", async function () {
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      const pool = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[3]
      );

      await expect(
        pool.connect(poolManager).manageInvestors([poolManager.address], true)
      ).to.be.revertedWith("CallerIsNotManager");
    });

    it("Success: add new investor", async function () {
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      const pool = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[3]
      );
      await pool.connect(user2).manageInvestors([poolManager.address], true);
      const investors = await pool.getInvestors();
      assert.equal(investors.length, 3);
    });

    it("Fail: remove new investor by not owner of pool", async function () {
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      const pool = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[3]
      );

      await expect(
        pool.connect(poolManager).manageInvestors([poolManager.address], false)
      ).to.be.revertedWith("CallerIsNotManager");
    });

    it("Success: remove investor", async function () {
      const poolAddressesArray = await factoryProxied.getPoolAddresses();
      const pool = await ethers.getContractAt(
        "PoolLogic",
        poolAddressesArray[3]
      );
      await pool.connect(user2).manageInvestors([poolManager.address], false);
      const investors = await pool.getInvestors();
      assert.equal(investors.length, 2);
    });
  });
  describe("Set new pool logic", function () {
    it("Fail:set new logic by not owner", async function () {
      await expect(
        factoryProxied.connect(user).setPoolLogic(platform5.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Success: set new logic", async function () {
      await factoryProxied.connect(owner).setPoolLogic(platform5.address);
    });
  });
  describe("Set new base uri", function () {
    it("Success: set new base uri", async function () {
      await factoryProxied
        .connect(owner)
        .setBaseUri("https://mainnet.infura.io/v3/");
    });
  });
  describe("getLibData", function () {
    it("Success: get Library data", async function () {
      const res = await factoryProxied.getDexLibraryData();
      assert.equal(res.storageLibContract, storageContract.address);
      assert.equal(res.estimateContract, dexEstimateLibrary.address);
      assert.equal(res.convertContract, dexConvertLibrary.address);
    });
  });
  describe("set DEX Lib", function () {
    it("Success: set DEX Lib", async function () {
      await factoryProxied.setDexLibs(
        platform3.address,
        platform4.address,
        platform5.address
      );
    });
  });
  describe("set Uni addresses", function () {
    it("Success: Uni addresses", async function () {
      await factoryProxied.setUniAddresses(
        platform3.address,
        platform4.address
      );
    });
  });
});
