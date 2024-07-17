const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pool", function () {
  const baseURI = "https://goerli.infura.io/v3/";
  let accounts;
  let owner;
  let user;
  let poolManager;
  let factoryProxied;
  let erc20_1, erc20_2, erc20_3, erc20_4, erc20_5;
  let wBNB;
  let platform1, platform2;
  let poolContract;
  let dexEstimateLibrary, dexConvertLibrary;
  let balance_1, balance_2;
  let storageContract;
  const lockPeriodInSec = 3600;
  let treasuryFund;
  let poolLibrary;
  let uniPair;
  let liquidityProvisionLibrary;

  const risk = 0;
  const fee = 10000; // = 10%
  let feeCollector;
  let futuresLibrary;

  before("setup others", async function () {
    await ethers.provider.send("hardhat_reset");

    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    user2 = accounts[8];
    poolManager = accounts[2];
    platform1 = accounts[3];
    platform2 = accounts[4];
    storageContract = accounts[5];
    treasuryFund = accounts[6];
    feeCollector = accounts[7];

    const UniPair = await ethers.getContractFactory("UniV2Pair");
    uniPair = await UniPair.connect(owner).deploy();
    await uniPair.deployed();

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

    let tx = await ct.deployTransaction.wait();

    const PersonalPoolLogic = await ethers.getContractFactory("PersonalPoolLogic");
    const personalPoolLogic = await PersonalPoolLogic.connect(owner).deploy();
    ct = await personalPoolLogic.deployed();

    const FactoryLogic = await ethers.getContractFactory("FactoryLogic");
    const factoryLogic = await FactoryLogic.connect(owner).deploy();
    ct = await factoryLogic.deployed();

    tx = await ct.deployTransaction.wait();

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
    poolLibrary = await PoolLibrary.deploy();

    const LendBorrowLibrary = await ethers.getContractFactory(
      "LendBorrowLibrary"
    );
    const lendBorrowLibrary = await LendBorrowLibrary.deploy();

    const LiquidityProvisionLibrary = await ethers.getContractFactory("LiquidityProvisionLibrary");
    liquidityProvisionLibrary = await LiquidityProvisionLibrary.deploy();

    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();

    const factoryParam = {
      fee: fee,
      treasuryFund: treasuryFund.address,
      storageContract: storageContract.address,
      dexConvert: dexConvertLibrary.address,
      dexEstimate: dexEstimateLibrary.address,
      poolLogic: poolLogic.address,
      poolLibrary: poolLibrary.address,
      liquidityProvisionLibrary: liquidityProvisionLibrary.address,
      personalPoolLogic: personalPoolLogic.address,
      lendBorrowLibrary: lendBorrowLibrary.address,
      futuresLibrary: futuresLibrary.address,
      networkNativeToken: wBNB.address,
      uniswapV2In: owner.address,
      uniswapV2Out: owner.address,
      venusContract: ethers.constants.AddressZero,
      horizonProtocolLib: ethers.constants.AddressZero,
      whitelistedAssets: [
        ethers.constants.AddressZero,
        erc20_1.address,
        erc20_2.address,
        erc20_3.address,
        erc20_4.address,
      ],
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

    factoryProxied = await FactoryLogic.attach(factoryProxy.address);

    await erc20_2.transfer(user.address, ethers.utils.parseEther("20"));
  });
  describe("Create pool", function () {
    it("Success: create pool with 2 assets and 1 platform", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        frequency: 60 * 60 * 24 * 7, // 7 days
        feePercentage: 10000,
        name: "Test Pool",
        symbol: "TPL",
        feeCollector: feeCollector.address,
        supportedAssets: [
          ethers.constants.AddressZero,
          erc20_1.address,
          erc20_2.address,
        ],
        supportedPlatforms: [platform1.address],
        whitelistedUsers: [],
        redemptionSupportedAssets: [
          erc20_1.address,
          ethers.constants.AddressZero
        ],
        risk: risk,
        minInvestmentAmount: ethers.utils.parseUnits("0.0001", "ether"),
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
      poolContract = await ethers.getContractAt("PoolLogic", poolAddress);

      console.log(await poolContract.poolInfo());
    });
  });
  describe("Invest to pool", function () {
    it("Success: invest in pool by owner", async function () {
      factoryProxied.once(
        "PoolContractEvent",
        (sender, poolCt, eventName, eventParams) => {
          assert.equal(sender, owner.address);
          assert.equal(poolCt, poolContract.address);
          assert.equal(eventName, "Invested");
          const decodedData = ethers.utils.defaultAbiCoder.decode(
            ["address", "uint256", "uint256", "uint256", "uint32"],
            eventParams
          );
          assert.equal(decodedData[0], erc20_1.address);
          assert.equal(decodedData[1], "6666666666666666");
          assert.equal(decodedData[2], ethers.utils.parseEther("2").toString());
          assert.equal(decodedData[3], "6666666666666666");
          console.log(decodedData[4], "+-", parseInt(Date.now() / 1000) + 3600);
        }
      );
      let balance = await erc20_1.balanceOf(owner.address);
      assert.equal(balance.toString(), ethers.utils.parseEther("100"));
      await erc20_1.approve(poolContract.address, ethers.utils.parseEther("2"));
      const tx = await poolContract.invest(
        erc20_1.address,
        ethers.utils.parseEther("2")
      );
      balance = await erc20_1.balanceOf(owner.address);
      assert.equal(balance.toString(), ethers.utils.parseEther("98"));

      await tx.wait();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });

    it("Success: invest in pool by user", async function () {
      let balance = await erc20_2.balanceOf(user.address);
      assert.equal(balance.toString(), ethers.utils.parseEther("20"));
      await erc20_2
        .connect(user)
        .approve(poolContract.address, ethers.utils.parseEther("5"));
      await poolContract
        .connect(user)
        .invest(erc20_2.address, ethers.utils.parseEther("4"));
    });
    it("Success: invest in pool by user (1)", async function () {
      await poolContract
        .connect(user)
        .invest(erc20_2.address, ethers.utils.parseEther("1"));
      balance = await erc20_2.balanceOf(user.address);
      assert.equal(balance.toString(), ethers.utils.parseEther("15"));
      const balanceLP = await poolContract.balanceOf(user.address);
      assert.equal(balanceLP.toString(), "16666666666666666");
    });
    it("Success: invest eth in pool by user", async function () {
      await poolContract
        .connect(user)
        .invest(ethers.constants.AddressZero, ethers.utils.parseEther("1"), {
          value: ethers.utils.parseEther("1"),
        });
      const balanceLP = await poolContract.balanceOf(user.address);
      assert.equal(balanceLP.toString(), "1016666666666666666");
    });
    it("Fail: invest not whitelisted token in pool", async function () {
      await expect(
        poolContract
          .connect(user)
          .invest(erc20_3.address, ethers.utils.parseEther("5"))
      ).to.be.revertedWith("NotSupportedToken()");
    });
  });
  describe("Withdraw in one asset", function () {
    it("Fail: withdraw by owner when timeLock", async function () {
      await expect(
        poolContract.withdraw(
          "5666666666666666",
          ethers.constants.AddressZero,
          1
        )
      ).to.be.revertedWith("YourTokensAreLocked()");
    });
    //   it("Success: withdraw by owner", async function () {
    //     await ethers.provider.send("evm_increaseTime", [5000]);
    //     await ethers.provider.send("evm_mine", []);

    //     let balanceOwner_1 = await erc20_1.balanceOf(owner.address);
    //     let balanceOwner_2 = await erc20_2.balanceOf(owner.address);
    //     assert.equal(balanceOwner_1.toString(), ethers.utils.parseEther("98"));
    //     assert.equal(balanceOwner_2.toString(), ethers.utils.parseEther("80"));

    //     const res = await poolLibrary.withdrawEstimation(
    //       factoryProxied.address,
    //       poolContract.address,
    //       "5666666666666666",
    //       ethers.constants.AddressZero
    //     );

    //     const value0 = parseInt(res[0].systemFee);
    //     const value1 = parseInt(res[1].systemFee);
    //     const value2 = parseInt(res[2].systemFee);

    //     const balanceBefore0 = await ethers.provider.getBalance(
    //       treasuryFund.address
    //     );
    //     const balanceBefore1 = await erc20_1.balanceOf(treasuryFund.address);
    //     const balanceBefore2 = await erc20_1.balanceOf(treasuryFund.address);

    //     await poolContract.withdraw(
    //       "5666666666666666",
    //       ethers.constants.AddressZero,
    //       1
    //     );

    //     const lpBalance = await poolContract.balanceOf(owner.address);
    //     assert.equal(lpBalance.toString(), "1000000000000000");
    //     balance_1 = await erc20_1.balanceOf(owner.address);
    //     balance_2 = await erc20_2.balanceOf(owner.address);
    //     const balanceAfter0 = await ethers.provider.getBalance(
    //       treasuryFund.address
    //     );
    //     const balanceAfter1 = await erc20_1.balanceOf(treasuryFund.address);
    //     const balanceAfter2 = await erc20_2.balanceOf(treasuryFund.address);

    //     console.log(balanceAfter0 - balanceBefore0, "+-", value0);
    //     assert.equal(balanceAfter1 - balanceBefore1, value1);
    //     assert.equal(balanceAfter2 - balanceBefore2, value2);
    //   });
    //   it("Fail: withdraw by owner more than possible", async function () {
    //     await expect(
    //       poolContract.withdraw(
    //         "2000000000000000",
    //         ethers.constants.AddressZero,
    //         1
    //       )
    //     ).to.be.revertedWith("InsufficientFunds()");
    //   });
  });
  describe("Withdraw in one asset after time", function () {
    it("Fail: withdraw by owner more than possible", async function () {
      await ethers.provider.send("evm_increaseTime", [5000]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        poolContract.withdraw("7666666666666666", erc20_1.address, 1)
      ).to.be.revertedWith("InsufficientFunds()");
    });
    it("Fail: withdraw by owner with NotSupportedToken", async function () {
      await expect(
        poolContract.withdraw("100000000000000", erc20_4.address, 1)
      ).to.be.revertedWith("NotSupportedToken()");
    });
    it("Fail: withdraw by owner when token is out of redemption option", async function () {
      await expect(
        poolContract.withdraw("100000000000000", erc20_2.address, 1)
      ).to.be.revertedWith("NotSupportedToken()");
    });
    it("Success: withdraw by owner", async function () {
      console.log(await erc20_1.balanceOf(owner.address));
      await poolContract.withdraw("100000000000000", erc20_1.address, 1);
      console.log(await erc20_1.balanceOf(owner.address));
      console.log(await poolContract.analytics(ethers.constants.AddressZero));
    });
    it("Fail: withdraw by owner when redemption window is closed", async function () {
      await expect(
        poolContract.withdraw("100000000000000", erc20_1.address, 1)
      ).to.be.revertedWith("RedemptionWindowClosed()");
    });
  });
  describe("Entry/exit fee", function () {
    it("Success: set entry and exit fee in percent", async function () {
      const entryFee = {
        isFixedAmount: false,
        feeAmount: "2000" // 2%
      }
      const exitFee = {
        isFixedAmount: false,
        feeAmount: "5000" // 5%
      }
      await poolContract.connect(poolManager).setEntryExitFee(entryFee, exitFee);
      const feeData = await poolContract.getEntryExitFee();
      expect(feeData[0].isFixedAmount).to.be.false;
      expect(feeData[0].feeAmount).to.be.equal("2000");
      expect(feeData[1].isFixedAmount).to.be.false;
      expect(feeData[1].feeAmount).to.be.equal("5000");

    })
    it("Success: invest in pool and extract fee", async function () {
      let prevFeeCollectorBalance = await erc20_1.balanceOf(feeCollector.address); 
      let balance = await erc20_1.balanceOf(owner.address);
      expect(balance).to.be.equal(ethers.utils.parseEther("98"));
      await erc20_1.approve(poolContract.address, ethers.utils.parseEther("2"));
      const tx = await poolContract.invest(
        erc20_1.address,
        ethers.utils.parseEther("2")
      );
      await tx.wait();
      balance = await erc20_1.balanceOf(owner.address);
      expect(balance).to.be.equal(ethers.utils.parseEther("96"));
      let currentFeeCollectorBalance = await erc20_1.balanceOf(feeCollector.address); 
      console.log("Fee: ", currentFeeCollectorBalance.sub(prevFeeCollectorBalance))
    });

    it("Success: withdraw amd extract fee", async function () {
      await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]);
      await ethers.provider.send("evm_mine", []);

      let prevFeeCollectorBalance = await erc20_1.balanceOf(feeCollector.address); 
      console.log(await erc20_1.balanceOf(owner.address));
      await poolContract.withdraw("1000000", erc20_1.address, 1);
      console.log(await erc20_1.balanceOf(owner.address));
      console.log(await poolContract.analytics(ethers.constants.AddressZero));
      let currentFeeCollectorBalance = await erc20_1.balanceOf(feeCollector.address); 
      console.log("Fee: ", currentFeeCollectorBalance.sub(prevFeeCollectorBalance))
    });
  })
  describe("Check metadata", function () {
    it("Success: get metadata", async function () {
      const res = await poolLibrary.metadata(
        factoryProxied.address,
        poolContract.address,
        poolManager.address
      );
      assert.equal(
        res,
        baseURI +
          poolManager.address.toLowerCase() +
          "/" +
          poolContract.address.toLowerCase() +
          ".json"
      );
    });
  });
  describe("Estimate Lp amount", function () {
    it("Success: estimate", async function () {
      const res = await poolLibrary.estimateLpAmount(
        factoryProxied.address,
        poolContract.address,
        erc20_1.address,
        "66666666",
        true
      );
      assert.equal(res, 222222);
    });
  });

  describe("setFeeCollectorAndFee", function () {
    it("Success: setFeeCollectorAndFee", async function () {
      await poolContract
        .connect(poolManager)
        .setFeeCollectorAndFee(erc20_1.address, "12000");
    });
  });
  describe("setMinMaxInvestmentAmount", function () {
    it("Success: set min and max amount ", async function () {
      await poolContract
        .connect(poolManager)
        .setMinMaxInvestmentAmount(
          ethers.utils.parseUnits("0.01", "ether"),
          ethers.utils.parseUnits("5", "ether"))
        ;
        const data = await poolContract.poolData();
        expect(data.minInvestmentAmount).to.be.equal(ethers.utils.parseUnits("0.01", "ether"));
        expect(data.maxInvestmentAmount).to.be.equal(ethers.utils.parseUnits("5", "ether"));
    });
    it("Fail: set min greater than max", async function () {
      await expect(poolContract
        .connect(poolManager)
        .setMinMaxInvestmentAmount(5, 1)
      ).to.be.revertedWith("MaxDepositLessMinDeposit");
    });

    it("Fail: set min greater than max", async function () {
      await expect(poolContract
        .connect(poolManager)
        .setMinMaxInvestmentAmount(5, 1)
      ).to.be.revertedWith("MaxDepositLessMinDeposit");
    });
    it("Fail: invest eth in pool by user (under the min invest)", async function () {
      await expect(
        poolContract
          .connect(user)
          .invest(
            ethers.constants.AddressZero,
            ethers.utils.parseEther("0.00001"),
            {
              value: ethers.utils.parseEther("0.00001"),
            }
          )
      ).to.be.revertedWith("LessOrGreaterThanAllowedValue()");
    });

    it("Fail: invest eth in pool by user (above the max invest)", async function () {
      await expect(
        poolContract
          .connect(user)
          .invest(
            ethers.constants.AddressZero,
            ethers.utils.parseEther("6"),
            {
              value: ethers.utils.parseEther("6"),
            }
          )
      ).to.be.revertedWith("LessOrGreaterThanAllowedValue()");
    });

  });
  describe("Close pool check", function () {
    it("Success: closePool", async function () {
      await poolContract.connect(poolManager).closePool();
    });
    it("Fail: invest eth in pool by user (when pool is closed)", async function () {
      await expect(
        poolContract
          .connect(user)
          .invest(
            ethers.constants.AddressZero,
            ethers.utils.parseEther("0.1"),
            {
              value: ethers.utils.parseEther("0.1"),
            }
          )
      ).to.be.revertedWith("PooLIsClose()");
    });
  });
  describe("View functions", function () {
    // it("Success: checkUnderlyingTokens", async function () {
    //   console.log(await poolContract.checkUnderlyingTokens(uniPair.address));
    // });

    it("Success: getFactoryAddress", async function () {
      assert.equal(
        await poolContract.getFactoryAddress(),
        factoryProxied.address
      );
    });
    it("Success: getSupportLiquidityPairs", async function () {
      const res = await poolContract.getSupportLiquidityPairs();
      assert.equal(res.toString(), "");
    });

    it("Success: getSupportedAssetsAndPlatforms", async function () {
      console.log(await poolContract.getSupportedAssetsAndPlatforms());
    });
    it("Success: getFeeCollected", async function () {
      console.log(await poolContract.analytics(ethers.constants.AddressZero));
    });
  });
  describe("directCallStrategy", function () {
    it("Fail: call directCallStrategy without directCallAllowance", async function () {
      let bytecode = await web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "amount",
              type: "uint256",
            },
          ],
          name: "approve",
          outputs: [
            {
              internalType: "bool",
              name: "",
              type: "bool",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        [poolContract.address, ethers.utils.parseEther("1")]
      );

      await expect(
        poolContract.connect(poolManager).directCallStrategy([
          {
            target: erc20_1.address,
            callData: bytecode,
          },
        ])
      ).to.be.revertedWith("DirectCallNotAllowed()");
    });
    it("Success: setDirectCallAllowance", async function () {
      await poolContract.connect(poolManager).setDirectCallAllowance(true);
    });
    it("Success: call directCallStrategy with directCallAllowance", async function () {
      let bytecode = await web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "amount",
              type: "uint256",
            },
          ],
          name: "approve",
          outputs: [
            {
              internalType: "bool",
              name: "",
              type: "bool",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        [poolContract.address, ethers.utils.parseEther("1")]
      );

      await poolContract.connect(poolManager).directCallStrategy([
        {
          target: erc20_1.address,
          callData: bytecode,
        },
      ]);
    });
  });
});
