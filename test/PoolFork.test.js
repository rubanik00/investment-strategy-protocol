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
  const usdt = "0x55d398326f99059fF775485246999027B3197955"
  let busd, usdc;
  let pairContract;
  let pairContract2;
  let lpAmount;
  let poolLibrary;
  let lendBorrowLibrary;
  let futuresLibrary;
  let vUsdc;
  let liquidityProvisionLibrary;
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
        // usdt
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
          wBNB
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
        risk: risk,
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
        poolContract1 = await ethers.getContractAt(
          "PersonalPoolLogic",
          poolAddressesArray[0]
        );
  
        console.log("Personal Trading Account deployed: ", poolContract1.address);
        console.log("Owner: ", owner.address);
      });
  });
  describe("Invest to pool", function () {
    it("Success: invest in pool by owner", async function () {
        console.log("BUSD balance owner", await busd.balanceOf(owner.address));
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
        "DDDDDD: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        )
      );

      console.log("BUSD balance owner", await busd.balanceOf(owner.address));
      console.log("BUSD balance pool", await busd.balanceOf(poolContract.address));
      console.log("usdc balance pool", await usdc.balanceOf(poolContract.address));
      console.log(
        "Pool LP balance owner",
        await poolContract.balanceOf(owner.address)
      );
      const res = await poolContract.analytics(ethers.constants.AddressZero);
      console.log(res.investedInUSD, "+- 150$");
    //   await poolContract.connect(poolManager).setAutoSwap(false, usdcAddress)
    });

    it("Success: invest in pool by user", async function () {
      let tx = await usdc
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
        "DDDDDD: ",
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        )
      );

      console.log("USDT balance user", await usdc.balanceOf(user.address));
      console.log(
        "Pool LP balance user",
        await poolContract.balanceOf(user.address)
      );
      const res = await poolContract.analytics(ethers.constants.AddressZero);
      console.log(res.investedInUSD, "+- 300$");
    });
    it("Success: invest BNB in pool by user", async function () {
      console.log(
        "LP balance user",
        await poolContract.balanceOf(user.address)
      );
      let tx = await poolContract
        .connect(user)
        .invest(ethers.constants.AddressZero, ethers.utils.parseEther("1"), {
          gasLimit: 1000000,
          value: ethers.utils.parseEther("1"),
        });
      await tx.wait();

      console.log(
        "DDDDDD: ", 
        await poolLibrary.getAssetAndBlockedAmountsToToken(
          factoryProxied.address,
          poolContract.address,
          ethers.constants.AddressZero
        )
      );

      console.log(
        "LP balance user",
        await poolContract.balanceOf(user.address)
      );
    });
  });

  describe("Set auto swap", function (){
    it("Success: set auto swap on to USDC by manager", async function () {
        expect((await poolContract.poolData()).autoSwap.isAutoSwapOn).to.be.false;
        expect((await poolContract.poolData()).autoSwap.autoSwapToken).to.be.equal(ethers.constants.AddressZero);
        await poolContract.connect(poolManager).setAutoSwap(true, usdcAddress);
        expect((await poolContract.poolData()).autoSwap.isAutoSwapOn).to.be.true;
        expect((await poolContract.poolData()).autoSwap.autoSwapToken).to.be.equal(usdcAddress);
    })

    it("Success: invest in pool by owner BUSD and auto swap to USDC", async function () {
          let tx = await busd
            .connect(owner)
            .approve(poolContract.address, ethers.utils.parseUnits("50", "ether"));
          await tx.wait();
    
          tx = await poolContract
            .connect(owner)
            .invest(busd.address, ethers.utils.parseEther("50"), {
              gasLimit: 1000000,
            });
          await tx.wait();
    
          console.log("BUSD balance owner", await busd.balanceOf(owner.address));
          console.log("BUSD balance pool", await busd.balanceOf(poolContract.address));
          console.log("USDC balance pool", await usdc.balanceOf(poolContract.address));
          console.log(
            "Pool LP balance owner",
            await poolContract.balanceOf(owner.address)
          );
          const res = await poolContract.analytics(owner.address);
          console.log(res.investedInUSD, "+- 200$");
    });
    it("Success: invest BNB in pool by user and auto swap to USDC", async function () {
        console.log(
            "ETH amount before:",
            await ethers.provider.getBalance(poolContract.address)
        );
        let tx = await poolContract
            .connect(user)
            .invest(ethers.constants.AddressZero, ethers.utils.parseEther("1"), {
            gasLimit: 1000000,
            value: ethers.utils.parseEther("1"),
            });
        await tx.wait();
    
        console.log(
            "DDDDDD: ",
            await poolLibrary.getAssetAndBlockedAmountsToToken(
            factoryProxied.address,
            poolContract.address,
            ethers.constants.AddressZero
            )
        );
    
        console.log(
            "ETH amount after:",
            await ethers.provider.getBalance(poolContract.address)
        );
        console.log(
            "LP balance user",
            await poolContract.balanceOf(user.address)
          );
        console.log("USDC balance pool", await usdc.balanceOf(poolContract.address));
        const res = await poolContract.analytics(user.address);
        console.log(res.investedInUSD, "+- 610$");
    });

    it("Success: set auto swap off  by manager", async function () {
        expect((await poolContract.poolData()).autoSwap.isAutoSwapOn).to.be.true;
        expect((await poolContract.poolData()).autoSwap.autoSwapToken).to.be.equal(usdcAddress);
        await poolContract.connect(poolManager).setAutoSwap(false, ethers.constants.AddressZero);
        expect((await poolContract.poolData()).autoSwap.isAutoSwapOn).to.be.false;
        expect((await poolContract.poolData()).autoSwap.autoSwapToken).to.be.equal(ethers.constants.AddressZero); 
    })
    
  })

  describe("Enter/Exit", function () {
    it("Success: enter by owner", async function () {
      console.log(
        "USDC amount before enter:",
        await usdc.balanceOf(poolContract.address)
      );
    
      const iface = new ethers.utils.Interface([
        "function enter(address,address,(address,address,uint256,uint256,address,(address,address,address[],address[][])[]))",
      ]);
      console.log(
        "USDC allowance before enter:",
        await usdc.allowance(poolContract.address, uniswapV2In)
      );
    
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
        "USDC amount after enter:",
        await usdc.balanceOf(poolContract.address)
      );
      console.log(
        "USDC allowance after enter:",
        await usdc.allowance(poolContract.address, uniswapV2In)
      );

   
    });
    it("Success: enter by owner (2)", async function () {
        const iface = new ethers.utils.Interface([
            "function enter(address,address,(address,address,uint256,uint256,address,(address,address,address[],address[][])[]))",
          ]);
        
          const data = iface.encodeFunctionData("enter", [
            factoryProxied.address,
            poolContract.address,
            Object.values({
                fromToken: usdc.address,
                pairAddress: pairAddress,
                amount: ethers.utils.parseEther("10"),
                minReceiveAmount: 1,
                exchangeRouterAddress: routerAddress,
                swapOptions: [],
            })
          ]);
    
          const tx = await poolContract
            .connect(poolManager)
            .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 1000000 });
          await tx.wait();

      const res = await poolContract.getSupportLiquidityPairs();
      console.log("supported liq pairs", res.length);
      console.log(
        "USDC amount after enter:",
        await usdc.balanceOf(poolContract.address)
      );
    });
    it("Fail: enter by owner with eth (more than possible)", async function () {
      const iface = new ethers.utils.Interface([
        "function enter(address,address,(address,address,uint256,uint256,address,(address,address,address[],address[][])[]))",
      ]);
    
      const data = iface.encodeFunctionData("enter", [
        factoryProxied.address,
        poolContract.address,
        Object.values({
            fromToken: ethers.constants.AddressZero,
            pairAddress: pairAddress2,
            amount: ethers.utils.parseEther("3.5"),
            minReceiveAmount: 1,
            exchangeRouterAddress: routerAddress,
            swapOptions: [],
        })
      ]);

      await expect(poolContract
        .connect(poolManager)
        .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 1000000 })).to.be.reverted;

    });
    it("Success: enter by poolManager with eth", async function () {
      factoryProxied.once(
        "PoolContractEvent",
        (sender, poolCt, eventName, eventParams) => {
        //   assert.equal(sender, poolManager.address);
        //   assert.equal(poolCt, poolContract.address);
          assert.equal(eventName, "Enter");
          const decodedData = ethers.utils.defaultAbiCoder.decode(
            ["address", "uint256", "uint256"],
            eventParams
          );
          lpAmount = decodedData[1];
          console.log(decodedData);
        }
      );
      console.log(
        "ETH amount before enter:",
        await ethers.provider.getBalance(poolContract.address)
      );
      console.log(
        "Pair balance before enter of eth",
        await pairContract2.balanceOf(poolContract.address)
      );

      const iface = new ethers.utils.Interface([
        "function enter(address,address,(address,address,uint256,uint256,address,(address,address,address[],address[][])[]))",
      ]);
    
      const data = iface.encodeFunctionData("enter", [
        factoryProxied.address,
        poolContract.address,
        Object.values({
            fromToken: ethers.constants.AddressZero,
            pairAddress: pairAddress2,
            amount: ethers.utils.parseEther("0.1"),
            minReceiveAmount: 1,
            exchangeRouterAddress: routerAddress,
            swapOptions: [],
        })
      ]);

      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 1500000 });
      await tx.wait();
      
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log(
        "ETH amount after enter:",
        await ethers.provider.getBalance(poolContract.address)
      );
      console.log(
        "Pair balance after enter of eth",
        await pairContract2.balanceOf(poolContract.address)
      );
    });
    it("Success: exit eth by poolManager", async function () {
      let res = await poolContract.getSupportLiquidityPairs();
      console.log("supported liq pairs", res.length);
      const lp = await pairContract2.balanceOf(poolContract.address);
      console.log(lp, "lp")

        const iface = new ethers.utils.Interface([
            "function exit(address,address,address,address,address,uint256,uint256,address)",
          ]);
        
          const data = iface.encodeFunctionData("exit", [
            factoryProxied.address,
            poolContract.address,
            poolContract.address,
            ethers.constants.AddressZero,
            pairAddress2,
            lp.div("2"),
            1,
            routerAddress,
          ]);
    
          const tx = await poolContract
            .connect(poolManager)
            .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 1000000 });
          await tx.wait();

      console.log(
        "Pair balance of eth after exit",
        await pairContract2.balanceOf(poolContract.address)
      );

      console.log(
        await ethers.provider.getBalance(poolContract.address),
        "+- 0.49 ETH"
      ); // +- 0.49 ETH
      res = await poolContract.getSupportLiquidityPairs();
      console.log("supported liq pairs", res.length);
    });

    it("Success: exit usdc by poolManager", async function () {
      let res = await poolContract.getSupportLiquidityPairs();
      console.log("supported liq pairs", res.length);
      const lp = await pairContract2.balanceOf(poolContract.address);
      console.log(lp, "lp")
      console.log(
        "USDC amount before exit:",
        await usdc.balanceOf(poolContract.address)
      );

      const iface = new ethers.utils.Interface([
          "function exit(address,address,address,address,address,uint256,uint256,address)",
        ]);
      
      
        const data = iface.encodeFunctionData("exit", [
          factoryProxied.address,
          poolContract.address,
          poolContract.address,
          ethers.constants.AddressZero,//usdc.address,
          pairAddress2,
          lp,
          1,
          routerAddress,
        ]);
  
        const tx = await poolContract
          .connect(poolManager)
          .libraryCall(liquidityProvisionLibrary.address, data, { gasLimit: 1000000 });
        await tx.wait();

      console.log(
        "Pair balance of eth after exit",
        await pairContract.balanceOf(poolContract.address)
      );

      console.log(
        "USDC amount after exit:",
        await usdc.balanceOf(poolContract.address)
      );
      res = await poolContract.getSupportLiquidityPairs();
      console.log("supported liq pairs", res.length);
    });
  });

  describe("Structured Products Call", function () {
    it("exchangeTokenToProduct", async function () {
      /*exchangeTokenToProduct(
        address factory,
        address sourceToken,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        uint256 minOutputAmount
      )*/

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

      vAmount = await convertContract.getVBalance(zJPY, poolContract.address);
      console.log("Deposited  [before] ", vAmount);

      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(poolLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();
      vAmount = await convertContract.getVBalance(zJPY, poolContract.address);
      console.log("Deposited  [after] ", vAmount);
    });
  });
  describe("convertWithPredefinedPath/convertArrayOfTokensToTokenLimited", function () {
    it("Success: convertArrayOfTokensToTokenLimited by owner", async function () {
      console.log(
        await ethers.provider.getBalance(poolContract.address),
        "+- 0.99 ETH"
      ); // +- 0.99 ETH

      const iface = new ethers.utils.Interface([
        "function convertArrayOfTokensToTokenLimited(address factory,address[] memory _tokens,uint256[] memory _amounts,address _convertToToken,uint256 _minTokensRec)",
      ]);

      const data = iface.encodeFunctionData(
        "convertArrayOfTokensToTokenLimited",
        [
          factoryProxied.address,
          [ethers.constants.AddressZero],
          [ethers.utils.parseUnits("0.9", "ether")],
          busdAddress,
          1,
        ]
      );

      await poolContract
        .connect(poolManager)
        .libraryCall(poolLibrary.address, data, { gasLimit: 5000000 });

      console.log(
        await ethers.provider.getBalance(poolContract.address),
        "+- 0.09 ETH"
      ); // +- 0.09 ETH
    });
    it("Success: convertWithPredefinedPath", async function () {
      const res = await dexEstimateContract.getConversionOptions(
        [routerAddress, routerAddress2],
        busdAddress,
        cakeAddress,
        ethers.utils.parseEther("10")
      );

      //   console.log("result:", res);

      // console.log("Dp:", res.directPath);

      //   var temp = res.amounts[0][0];
      //   console.log("ff", temp);
      // for (var i = 0; i < res.amounts.length; i++) {
      //   for (var j = 0; j < res.amounts[i].length; j++) {
      //     if (res.amounts[i][j] > temp) {
      //       console.log(temp);
      //       console.log(res.amounts[i][j]);
      //       temp = res.amounts[i][j];
      //     }
      //   }
      // }

      // console.log("Temp", temp);

      //   const fivePercent = (temp * 500) / 100000;
      //   const minAmount = temp + fivePercent;
      //   console.log("Min Amt:", minAmount);

      const iface = new ethers.utils.Interface([
        "function convertWithPredefinedPath(address factory,uint256 _amount,uint256 _minOutputAmount,address[] memory _routers,address[][] memory paths)",
      ]);

      const data = iface.encodeFunctionData("convertWithPredefinedPath", [
        factoryProxied.address,
        ethers.utils.parseEther("10"),
        1,
        [routerAddress],
        [res.directPath],
      ]);

      await poolContract
        .connect(poolManager)
        .libraryCall(poolLibrary.address, data, { gasLimit: 5000000 });
    });
  });
  describe("Venus lend and borrow", function () {
    let vAmount;
    let vAmountBorrow;
    it("Success: lend by manager vUSDC", async function () {
      console.log(await usdc.balanceOf(poolContract.address));

      const iface = new ethers.utils.Interface([
        "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusDeposit", [
        factoryProxied.address,
        poolContract.address,
        vUSDC,
        ethers.utils.parseEther("50"),
      ]);

      const tx = await poolContract
        .connect(poolManager)
        .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
      await tx.wait();
      vAmount = await convertContract.getVBalance(vUSDC, poolContract.address);
      console.log("Deposited amt ", vAmount);
    });

    it("Success: borrow by manager", async function () {
      const iface = new ethers.utils.Interface([
        "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
      ]);

      const data = iface.encodeFunctionData("venusBorrow", [
        factoryProxied.address,
        poolContract.address,
        vBNB,
        ethers.utils.parseEther("0.005"),
      ]);
    });

    // it("Success: redeem by manager vUSDC", async function () {
    //   console.log(await usdc.balanceOf(poolContract.address));

    //   const iface = new ethers.utils.Interface([
    //     "function venusRedeem(address factory,address pool,address vTokenMarket,uint256 amount)",
    //   ]);

    //   const data = iface.encodeFunctionData("venusRedeem", [
    //     factoryProxied.address,
    //     poolContract.address,
    //     vUSDC,
    //     100,
    //   ]);

    //   const tx = await poolContract
    //     .connect(poolManager)
    //     .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
    //   await tx.wait();
    // });

    // it("Success: lend by manager vCAKE", async function () {
    //   console.log(await usdc.balanceOf(poolContract.address));

    //   const iface = new ethers.utils.Interface([
    //     "function venusDeposit(address factory,address pool,address vTokenMarket,uint256 amount)",
    //   ]);

    //   const data = iface.encodeFunctionData("venusDeposit", [
    //     factoryProxied.address,
    //     poolContract.address,
    //     vCAKE,
    //     ethers.utils.parseEther("0.1"),
    //   ]);

    //   const tx = await poolContract
    //     .connect(poolManager)
    //     .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
    //   await tx.wait();
    //   vAmount = await convertContract.getVBalance(vCAKE, poolContract.address);
    //   console.log("Deposited amt ", vAmount);
    // });

    // it("Success: lend by manager vBNB", async function () {
    //   console.log(await usdc.balanceOf(poolContract.address));
    //   await poolContract
    //     .connect(poolManager)
    //     .venusDeposit(vBNB, ethers.utils.parseEther("0.01"), {
    //       gasLimit: 3000000,
    //       value: ethers.utils.parseEther("0.01"),
    //     });
    //   vAmount = await convertContract.getVBalance(vBNB, poolContract.address);
    //   console.log("Deposited amt ", vAmount);
    // });

    // it("Success: borrow by manager", async function () {
    //   const iface = new ethers.utils.Interface([
    //     "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
    //   ]);

    //   const data = iface.encodeFunctionData("venusBorrow", [
    //     factoryProxied.address,
    //     poolContract.address,
    //     vCAKE,
    //     ethers.utils.parseEther("5"),
    //   ]);

    //   const tx = await poolContract
    //     .connect(poolManager)
    //     .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
    //   await tx.wait();

    //   vAmountBorrow = await convertContract.getBorrowedBalance(
    //     vCAKE,
    //     poolContract.address
    //   );
    //   console.log("borrow balance: ", vAmountBorrow);
    // });

    // vAmountBorrow = await convertContract.getBorrowedBalance(
    //   vCAKE,
    //   poolContract.address
    // );

    //   //with this time you may get: Error(re-entered)
    //   //with this you may get: Error(VenusProtocolLibrary: Failed to borrow from market.)
    //   /*for (let c = 0; c < 10; c++) {
    //     await network.provider.request({
    //       method: "evm_increaseTime",
    //       params: [20000], // 20 seconds
    //     });
    //     await network.provider.request({
    //       method: "evm_mine",
    //     });
    //     console.log("+");
    //   }*/

    // console.log(`--------------2-----------------`);
    // const iface = new ethers.utils.Interface([
    //   "function venusBorrow(address factory,address pool,address vTokenMarket,uint256 amount)",
    // ]);

    // const data = iface.encodeFunctionData("venusBorrow", [
    //   factoryProxied.address,
    //   poolContract.address,
    //   vBNB,
    //   ethers.utils.parseEther("0.03"),
    // ]);

    // const tx = await poolContract
    //   .connect(poolManager)
    //   .libraryCall(lendBorrowLibrary.address, data, { gasLimit: 5000000 });
    // await tx.wait();

    // vAmountBorrow = await convertContract.getBorrowedBalance(
    //   vBNB,
    //   poolContract.address
    // );
    // console.log(vAmountBorrow);
    //   console.log(`--------------3-----------------`);
    // });
    // it("Success: repay by manager", async function () {
    //   await poolContract.connect(poolManager).venusRepay(vCAKE, vAmountBorrow, {
    //     gasLimit: 2000000,
    //   });
    //   vAmountBorrow = await convertContract.getBorrowedBalance(
    //     vCAKE,
    //     poolContract.address
    //   );
    //   console.log("borrowed amount", vAmountBorrow);
    // });

    // it("Success: redeem by manager", async function () {
    //   await poolContract.connect(poolManager).venusRedeem(vUSDC, 200000000000, {
    //     gasLimit: 2000000,
    //   });
    //   vAmount = await convertContract.getVBalance(vUSDC, poolContract.address);
    // });
  });
  describe("Withdraw in one asset", function () {
    it("Success: withdraw by user in one asset", async function () {
      const lpBalance = await poolContract.balanceOf(user.address);
      console.log("lpBalance", lpBalance);
      console.log("usdc before", await usdc.balanceOf(user.address));

      console.log(
        await poolLibrary
          .connect(user)
          .withdrawEstimation(
            factoryProxied.address,
            poolContract.address,
            lpBalance,
            usdcAddress
          )
      );
      let res = await poolContract.getSupportLiquidityPairs();
      assert.equal(res.length, 1);

      let tx = await poolContract
        .connect(user)
        .withdraw(lpBalance, usdcAddress, 1, {
          gasLimit: 5000000,
        });
      await tx.wait();
      console.log("usdc after", await usdc.balanceOf(user.address));
      res = await poolContract.getSupportLiquidityPairs();
      assert.equal(res.length, 1);

      // console.log(await poolContract.analytics(ethers.constants.AddressZero));
      // console.log(await poolContract.getFeeCollected());
    });

    it("Success: withdraw by owner in one asset", async function () {
      const lpBalance = await poolContract.balanceOf(owner.address);
      console.log("lpBalance", lpBalance);
      //   const balance = "1000000000";
      console.log(
        await poolLibrary
          .connect(owner)
          .withdrawEstimation(
            factoryProxied.address,
            poolContract.address,
            lpBalance,
            usdcAddress
          )
      );
      console.log("usdc before", await usdc.balanceOf(owner.address));
      let res = await poolContract.getSupportLiquidityPairs();

      let tx = await poolContract
        .connect(owner)
        .withdraw(lpBalance, usdcAddress, 1, {
          gasLimit: 5000000,
        });
      await tx.wait();
      console.log("usdc after", await usdc.balanceOf(owner.address));
      res = await poolContract.getSupportLiquidityPairs();
      //   assert.equal(res.length, 0);
    });
  });
});
