const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("Personal Pool", function () {
  let accounts;
  let owner;
  let user;
  let poolManager;
  let factoryProxied;
  let platform1, platform2;
  let poolContract;
  let convertContract;
  let treasury;
  const fee = 10000; // = 10%
  const lockPeriodInSec = 1;
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
  let liquidityProvisionLibrary;

  before("setup others", async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    poolManager = accounts[2];
    platform1 = accounts[3];
    platform2 = accounts[4];
    treasury = accounts[5];

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

    const FuturesLibrary = await ethers.getContractFactory("FuturesLibrary");
    futuresLibrary = await FuturesLibrary.deploy();
    const factoryParam = {
      fee: fee,
      treasuryFund: treasury.address,
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

  describe("Create personal pool (personal trading account)", function () {
    it("Success: create pool with 2 assets and 1 platform", async function () {
      const poolParams = {
        privacyStatus: false,
        published: true,
        lockPeriodInSec: lockPeriodInSec,
        frequency:0,
        feePercentage: 10000,
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
        ],
        whitelistedUsers: [],
        redemptionSupportedAssets: [],
        risk: 1,
        minInvestmentAmount: ethers.utils.parseUnits("0.01", "ether"),
        maxInvestmentAmount: ethers.utils.parseUnits("3000", "ether"),
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
    it("Success: create personal pool", async function () {
      const poolParams = {
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
        ]
      };

      let tx = await factoryProxied.connect(owner).createPersonalPool(poolParams);
      await tx.wait();
      const poolAddressesArray = await factoryProxied.getPersonalPoolAddresses();
      poolContract = await ethers.getContractAt(
        "PersonalPoolLogic",
        poolAddressesArray[0]
      );

      console.log("Personal Trading Account deployed: ", poolContract.address);
      console.log("Owner: ", owner.address);

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
        .connect(owner)
        .convert(
          [ethers.constants.AddressZero],
          [ethers.utils.parseUnits("20", "ether")],
          usdcAddress,
          { value: ethers.utils.parseUnits("20", "ether") }
        );
      await tx.wait();
    });
    
    it("Success: create personal pool", async function () {
      const poolParams = {
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
        ]
      };

      let tx = await factoryProxied.connect(owner).createPersonalPool(poolParams);
      await tx.wait();
      const poolAddressesArray = await factoryProxied.getPersonalPoolAddresses();
      poolContract = await ethers.getContractAt(
        "PersonalPoolLogic",
        poolAddressesArray[0]
      );

      console.log("Personal Trading Account deployed: ", poolContract.address);
      console.log("Owner: ", owner.address);
      console.log("Personal pool info", await poolContract.poolInfo())
      console.log("Personal pool assetsUnderManagement", await poolContract.assetsUnderManagement())

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
        .connect(owner)
        .convert(
          [ethers.constants.AddressZero],
          [ethers.utils.parseUnits("20", "ether")],
          usdcAddress,
          { value: ethers.utils.parseUnits("20", "ether") }
        );
      await tx.wait();
    });
  });

  describe("Deposit to pool", function () {
    it("Success: deposit BUSD in pool by owner", async function () {
      const investAmount = ethers.utils.parseUnits("150", "ether");
      let tx = await busd
        .connect(owner)
        .approve(poolContract.address, investAmount);
      await tx.wait();

      tx = await poolContract
        .connect(owner)
        .invest(busd.address, investAmount, {
          gasLimit: 1000000,
        });
      await tx.wait();

      expect(
        await busd.balanceOf(poolContract.address)
      ).to.be.equal(investAmount);

      const res = await poolContract.analytics(ethers.constants.AddressZero);
      // console.log(res.investedInUSD, "+- 150$");
    });

    it("Success: deposit BNB in pool by owner", async function () {
      const investAmount = ethers.utils.parseEther("10");
      let tx = await poolContract
        .connect(owner)
        .invest(ethers.constants.AddressZero, investAmount, {
          gasLimit: 1000000,
          value: investAmount,
        });
      await tx.wait();

      expect(
        await ethers.provider.getBalance(poolContract.address)
      ).to.be.equal(investAmount);
    });

    it("Success: deposit USDC in pool by owner", async function () {
      const investAmount = ethers.utils.parseUnits("150", "ether");
      let tx = await usdc
        .connect(owner)
        .approve(poolContract.address, investAmount);
      await tx.wait();
      tx = await poolContract
        .connect(owner)
        .invest(usdc.address, investAmount, {
          gasLimit: 1000000,
        });
      await tx.wait();

      expect(
        await usdc.balanceOf(poolContract.address)
      ).to.be.equal(investAmount);

      const res = await poolContract.analytics(ethers.constants.AddressZero);
      // console.log(res.investedInUSD, "+- 300$");
    });

    it("Fail: deposit USDC in pool by non-owner", async function () {
      const investAmount = ethers.utils.parseEther("1");
      await expect(
        poolContract
          .connect(user)
          .invest(ethers.constants.AddressZero, investAmount, {
            gasLimit: 1000000,
            value: investAmount,
          })
      ).to.be.reverted;
    });
  });

  describe("Liquidity Provision", function () {
    it("Success: enter by owner (provide liquidity)", async function () {
      expect(
        await usdc.balanceOf(poolContract.address)
      ).to.be.equal(ethers.utils.parseUnits("150", "ether"));
      expect(await pairContract.balanceOf(poolContract.address)).to.be.equal(0);

      await poolContract.connect(owner).enter(
        {
          fromToken: usdc.address,
          pairAddress: pairAddress,
          amount: ethers.utils.parseEther("90"),
          minReceiveAmount: 1,
          exchangeRouterAddress: routerAddress,
          swapOptions: [],
        },
        { gasLimit: 1000000 }
      );

      const res = await poolContract.getSupportLiquidityPairs();

      expect(
        await pairContract.balanceOf(poolContract.address)
      ).to.be.above(0);
      expect(res.length).to.be.equal(1);
      expect(res[0]).to.be.equal(pairAddress);
    });
    it("Success: enter by owner (provide liquidity) (2)", async function () {
      const lpBalance = await pairContract.balanceOf(poolContract.address);

      await poolContract.connect(owner).enter(
        {
          fromToken: usdc.address,
          pairAddress: pairAddress,
          amount: ethers.utils.parseEther("10"),
          minReceiveAmount: 1,
          exchangeRouterAddress: routerAddress,
          swapOptions: [],
        },
        { gasLimit: 1000000 }
      );
      const res = await poolContract.getSupportLiquidityPairs();
      const updatedLpBalance = await pairContract.balanceOf(poolContract.address);

      expect(res.length).to.be.equal(1);
      expect(res[0]).to.be.equal(pairAddress);
      expect(updatedLpBalance).to.be.above(lpBalance);
    });

    it("Success: exit (remove liquidity) by owner", async function () {
      let res = await poolContract.getSupportLiquidityPairs();

      expect(res.length).to.be.equal(1);
      expect(res[0]).to.be.equal(pairAddress);

      const lp = await pairContract.balanceOf(poolContract.address);

      await poolContract
        .connect(owner)
        .exit(
          ethers.constants.AddressZero,
          pairAddress,
          lp,
          1,
          routerAddress,
          { gasLimit: 1000000 }
        );

      expect(
        await pairContract.balanceOf(poolContract.address)
      ).to.be.equal(0);

      // console.log(
      //   await ethers.provider.getBalance(poolContract.address),
      //   "+- 0.99 ETH"
      // ); // +- 0.99 ETH
      res = await poolContract.getSupportLiquidityPairs();
      expect(res.length).to.be.equal(0);
    });
  });

  describe("Structured Products Call", function () {
    it("Success: exchangeTokenToProduct", async function () {
      await owner.sendTransaction({
        to: poolContract.address,
        value: ethers.utils.parseUnits("0.01", "ether"),
      });

      const iface = new ethers.utils.Interface([
        "function exchangeTokenToProduct(address,address,uint256,bytes32,uint256)",
      ]);

      const zJPY = "0x65678dF3CAf8C72835A200291f1d7F610951F34c";

      const data = iface.encodeFunctionData("exchangeTokenToProduct", [
        factoryProxied.address,
        ethers.constants.AddressZero,
        ethers.utils.parseEther("0.001"),
        "0x7a4a505900000000000000000000000000000000000000000000000000000000",
        1,
      ]);

      const balance = await convertContract.getVBalance(zJPY, poolContract.address);

      expect(
        balance
      ).to.be.equal(0);

      const tx = await poolContract
        .connect(owner)
        .libraryCall(poolLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();

      const updatedBalance = await convertContract.getVBalance(zJPY, poolContract.address);

      expect(
        updatedBalance
      ).to.be.above(0);
    });
  });

  describe("Venus lend and borrow", function () {
    let vAmount;
    let vAmountBorrow;

    it("Success: lend by manager vUSDC", async function () {
      const balance = await usdc.balanceOf(poolContract.address);
      const supplyAmount = ethers.utils.parseEther("50");

      const iface = new ethers.utils.Interface([
        "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusDeposit", [
        factoryProxied.address,
        poolContract.address,
        vUSDC,
        supplyAmount,
      ]);

      const tx = await poolContract
        .connect(owner)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();

      const updatedBalance = await usdc.balanceOf(poolContract.address);

      expect(
        updatedBalance
      ).to.be.equal(balance - supplyAmount);
      vAmount = await convertContract.getVBalance(vUSDC, poolContract.address);
      // console.log("Deposited amt ", vAmount);
    });

    it("Success: lend by manager vBNB", async function () {
      const iface = new ethers.utils.Interface([
        "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusDeposit", [
        factoryProxied.address,
        poolContract.address,
        vBNB,
        ethers.utils.parseEther("1"),
      ]);

      const tx = await poolContract
        .connect(owner)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();
      vAmount = await convertContract.getVBalance(vBNB, poolContract.address);
      // console.log("Deposited amt ", vAmount);
    });

    it("Success: borrow USDC by owner", async function () {
      vAmountBorrow = ethers.utils.parseEther("10");
      const balance = await usdc.balanceOf(poolContract.address);

      const iface = new ethers.utils.Interface([
        "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusBorrow", [
        factoryProxied.address,
        poolContract.address,
        vUSDC,
        vAmountBorrow,
      ]);

      const tx = await poolContract
        .connect(owner)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();

      const balanceUpdated = await usdc.balanceOf(poolContract.address);

      expect(balanceUpdated).to.be.equal(balance + vAmountBorrow);
    });

    // TODO: check out on the mainnet
    // reverts with "Error(venusBorrow: Unknown())" on fork
    it.skip("Success: borrow BNB by owner", async function () {
      const iface = new ethers.utils.Interface([
        "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      console.log("BNB BALANCE: ", await ethers.provider.getBalance(poolContract.address));
      const data = iface.encodeFunctionData("venusBorrow", [
        factoryProxied.address,
        poolContract.address,
        vBNB,
        ethers.utils.parseEther("0.02"),
      ]);

      const tx = await poolContract
        .connect(owner)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();
    });
  });

    describe("Futures", function () {
    it("Success: placeMarketOrder (BNB) by owner", async function () {
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

      const tx = await poolContract
        .connect(owner)
        .libraryCall(futuresLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();
    });
  });

  describe("Withdraw from pool", function () {
    it("Success: withdraw BUSD from pool by owner", async function () {
      const withdrawAmount = ethers.utils.parseEther("150");
      const ownersBalance = await busd.balanceOf(owner.address);
      const poolBalance = await busd.balanceOf(poolContract.address);
      const treasuryBalance = await busd.balanceOf(treasury.address);

      tx = await poolContract
        .connect(owner)
        .withdraw(busd.address, withdrawAmount, {
          gasLimit: 1000000,
        });
      await tx.wait();

      const updatedOwnersBalance = await busd.balanceOf(owner.address);
      const updatedPoolBalance = await busd.balanceOf(poolContract.address);
      const updatedTreasuryBalance = await busd.balanceOf(treasury.address);
      const feeAmount = (withdrawAmount.mul(fee)).div(1000000);

      expect(updatedOwnersBalance).to.be.equal(ownersBalance.add(withdrawAmount.sub(feeAmount)));
      expect(updatedTreasuryBalance).to.be.equal(treasuryBalance.add(feeAmount));
      expect(updatedPoolBalance).to.be.equal(poolBalance.sub(withdrawAmount));

      const res = await poolContract.analytics(ethers.constants.AddressZero);
      // console.log(res.withdrawnInUSD, "+- 150$");
    });
  });
});