// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IFactory.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolLibrary.sol";
import "./interfaces/ILiquidityProvisionLibrary.sol";
import "./interfaces/ILendBorrowLibrary.sol";

import "./lib/RevertReasonParser.sol";

contract PoolLogic is
    Initializable,
    ERC20Upgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    EnumerableSet.AddressSet private supportedAssets; // addresses of supported tokens
    EnumerableSet.AddressSet private redemptionSupportedAssets; // addresses of supported tokens to withdraw
    EnumerableSet.AddressSet private supportedPlatforms; // addresses of supported platforms
    EnumerableSet.AddressSet private investorAddresses; // addresses of private investors
    EnumerableSet.AddressSet private supportedLiquidityPairs; // addresses of liquidity pairs
    EnumerableSet.Bytes32Set private uniqFutureData; // data for futures methods
    bytes[] private placeOrderResponses; // array of bytes with futures data
    uint24 private constant ONE_HUNDRED_WITH_ACCURACY = 100000; // one hundred percent with accuracy
    uint256 public withdrawFrequency;

    struct PoolData {
        bool published; // if true - all users can see this pool; if false - only manager can see this pool;
        bool privacyStatus; // if true - only investorAddresses can interact; if false - all users can interact
        bool isClose; // marking that the pull is closed for use forever;
        bool directCallAllowed; // marking that poolManager can use external calls for assets;
        uint32 lockTimeInSec; // lock period in seconds for lp token;
        uint24 feePercentage; // fee percentage for feeCollector; 1% = 1000;
        address manager; // address of pool owner
        address feeCollector; // fee collector address for performance fee;
        IFactory factory; // address of factory
        uint256 minInvestmentAmount; // minimum amount for invest;
        uint256 maxInvestmentAmount; // maximum amount for invest;
        IPool.Fee entryFee; // entry fee as percentage or fixed
        IPool.Fee exitFee; // exit fee as percentage or fixed
        IPool.AutoSwap autoSwap;
    }

    PoolData public poolData; // pool storage data

    address private constant USDT_ADDRESS =
        0x55d398326f99059fF775485246999027B3197955; // BSC USDT address;

    mapping(address => uint32) public investorLockPeriod; // share tokens frozen period for the investor;
    mapping(address => IPool.Analytics) public analytics; // analytic data;
    mapping(address => uint256) public investorWithdrawTimestamp;

    /**
     * @dev Throws if called by any account other than the Manager.
     */
    modifier onlyManager() {
        if (msg.sender != poolData.manager) revert IPool.CallerIsNotManager();
        _;
    }

    /**
     * @dev Returns revert if called by any account other than investor (if private pool is enabled)
     */
    modifier onlyInvestors() {
        if (poolData.privacyStatus) {
            if (!investorAddresses.contains(msg.sender))
                revert IPool.NotOnTheListOfInvestors();
        }
        _;
    }

    /**
     * @dev Returns revert if pool not open
     */
    modifier onlyOpenPool() {
        if (poolData.isClose) {
            revert IPool.PooLIsClose();
        }
        _;
    }

    receive() external payable {}

    // fallback() external payable {}

    constructor() {
        _disableInitializers();
    }

    /**
    @notice Pool initialization function with initial parameters
    @param poolParams pool details struct, that contains:
    pool name
    pool symbol
    (pool description, pool image, investment prospectus, manager name, company name, etc),
    private status (if true - only investorAddresses can interact; if false - all users can interact),
    publish status (if true - all users can see this pool; if false - only manager can see this pool;),
    list of assets that will be supported.
    list of platforms that will be supported.
    list of private users (used if the private status is true)
    lockPeriodInSec - freeze period for user tokens
    feeCollector - the account to which fee will be sent
    feePercentage - fee percentage (1% = 1000)
    manager - pool manager address
    minInvestmentAmount - minimum investment amount
    maxInvestmentAmount - maximum investment amount
    */
    function initialize(
        IPool.PoolParams calldata poolParams
    ) external initializer {
        __ERC20_init(poolParams.name, poolParams.symbol);

        poolData.factory = IFactory(msg.sender);
        poolData.manager = poolParams.manager;
        poolData.privacyStatus = poolParams.privacyStatus;
        poolData.published = poolParams.published;
        poolData.lockTimeInSec = poolParams.lockPeriodInSec;
        poolData.feeCollector = poolParams.feeCollector;
        poolData.feePercentage = poolParams.feePercentage;
        poolData.minInvestmentAmount = poolParams.minInvestmentAmount;
        poolData.maxInvestmentAmount = poolParams.maxInvestmentAmount;
        poolData.entryFee = poolParams.entryFee;
        poolData.exitFee = poolParams.exitFee;
        poolData.autoSwap = poolParams.autoSwap;
        poolData.autoSwap.autoSwapToken = poolParams.autoSwap.autoSwapToken;
        withdrawFrequency = poolParams.frequency;

        for (uint256 i = 0; i < poolParams.supportedAssets.length; ) {
            supportedAssets.add(poolParams.supportedAssets[i]);
            unchecked {
                ++i;
            }
        }

        for (uint256 i = 0; i < poolParams.redemptionSupportedAssets.length; ) {
            address token = poolParams.redemptionSupportedAssets[i];
            if (!supportedAssets.contains(token)) revert IPool.NotSupportedToken();
            redemptionSupportedAssets.add(token);
            unchecked {
                ++i;
            }
        }

        for (uint256 i = 0; i < poolParams.supportedPlatforms.length; ) {
            supportedPlatforms.add(poolParams.supportedPlatforms[i]);
            unchecked {
                ++i;
            }
        }

        if (poolParams.privacyStatus) {
            for (uint256 i = 0; i < poolParams.whitelistedUsers.length; ) {
                investorAddresses.add(poolParams.whitelistedUsers[i]);
                unchecked {
                    ++i;
                }
            }
        }
    }

    /// @dev invest
    /// @notice allows user invest funds to pool
    /// @notice receive an LP token in return
    /// @param token address of invested asset
    /// @param investAmount invested amount

    function invest(
        address token,
        uint256 investAmount
    ) external payable onlyInvestors onlyOpenPool {
        if (!supportedAssets.contains(token)) revert IPool.NotSupportedToken();
        PoolData memory pool = poolData;

        IPoolLibrary poolLibrary = IPoolLibrary(
            pool.factory.getPoolLibraryAddress()
        );

        if (token != address(0))
            IERC20(token).safeTransferFrom(
                msg.sender,
                address(this),
                investAmount
            );
        else {
            if(investAmount != msg.value) revert IPool.IncorrectInvestValue();
        }

        if (pool.autoSwap.isAutoSwapOn){
            (address storageContract, , address convertLibrary) = poolData.factory.getDexLibraryData();
            (bool status, bytes memory returnData) = convertLibrary
                        .delegatecall(
                            abi.encodeWithSignature(
                                "convertTokenToToken(address,address,address,address,uint256,uint256)",
                                storageContract,
                                address(this),
                                token,
                                pool.autoSwap.autoSwapToken,
                                investAmount,
                                1
                            )
                        );
            if (!status) revert IPool.BadERC20CallResult();
            investAmount = abi.decode(returnData, (uint256));
            token =  pool.autoSwap.autoSwapToken;
        }

        uint256 investInUSDT = poolLibrary.getAmtInToken(
            address(pool.factory),
            token,
            USDT_ADDRESS,
            investAmount
        );

        uint256 entryFeeInUSDT = pool.entryFee.isFixedAmount ? pool.entryFee.feeAmount
            : pool.entryFee.feeAmount * investInUSDT / 100000;
        if (entryFeeInUSDT > investInUSDT)
            revert IPool.EntryFeeIsGreaterThanInvestAmount();
        
        investInUSDT -= entryFeeInUSDT;
        if (investInUSDT < pool.minInvestmentAmount || (investInUSDT > pool.maxInvestmentAmount && pool.maxInvestmentAmount > 0))
            revert IPool.LessOrGreaterThanAllowedValue();
        uint256 entryFeeInToken = poolLibrary.getAmtInToken(
            address(pool.factory),
            USDT_ADDRESS,
            token,
            entryFeeInUSDT
        );

        _send(token, poolData.feeCollector, entryFeeInToken);

        uint256 amountToMint = poolLibrary.estimateLpAmount(
            address(pool.factory),
            address(this),
            token,
            investAmount - entryFeeInToken,
            false
        );

        investorLockPeriod[msg.sender] =
            uint32(block.timestamp) +
            pool.lockTimeInSec;

        _mint(msg.sender, amountToMint);

        analytics[address(0)].investedInUSD += investInUSDT;
        analytics[msg.sender].investedInUSD += investInUSDT;

        IFactory(pool.factory).generatePoolEvent(
            "Invested",
            abi.encode(
                token,
                investInUSDT,
                investAmount - entryFeeInToken,
                amountToMint,
                uint32(block.timestamp) + pool.lockTimeInSec
            )
        );
    }

    /// @dev withdraw
    /// @notice allows user withdraw funds from pool
    /// @notice receive an Underlying token in return
    /// @param lpAmount amount of LP tokens
    /// @param convertToTokenAddress convert token address
    /// @param minAmount min amount for withdraw

    function withdraw(
        uint256 lpAmount,
        address convertToTokenAddress,
        uint256 minAmount
    ) external payable nonReentrant {
        IPool.WithdrawInternalParams memory internalParams;

        (
            internalParams.assetsToProcess,
            internalParams.availableLpAmount
        ) = IPoolLibrary(poolData.factory.getPoolLibraryAddress())
            .withdrawEstimation(
                address(poolData.factory),
                address(this),
                lpAmount,
                convertToTokenAddress
            );

        uint256 length = redemptionSupportedAssets.length();
        if (length == 0 && !supportedAssets.contains(convertToTokenAddress))
            revert IPool.NotSupportedToken();
        if (length != 0 && !redemptionSupportedAssets.contains(convertToTokenAddress)) 
            revert IPool.NotSupportedToken(); // if redemptionSupportedAssets is empty - no restriction
        if (block.timestamp < investorWithdrawTimestamp[msg.sender] + withdrawFrequency) 
            revert IPool.RedemptionWindowClosed();
        (
            internalParams.storageContract,
            ,
            internalParams.convertLibrary
        ) = poolData.factory.getDexLibraryData();
        (internalParams.treasuryAddress, ) = poolData
            .factory
            .getTreasuryAddressAndFee();
        for (uint32 i; i < internalParams.assetsToProcess.length; ) {
            if (internalParams.assetsToProcess[i].balanceNative > 0) {
                _send(
                    internalParams.assetsToProcess[i].assetAddress,
                    poolData.feeCollector,
                    internalParams.assetsToProcess[i].performanceFee
                );
                _send(
                    internalParams.assetsToProcess[i].assetAddress,
                    internalParams.treasuryAddress,
                    internalParams.assetsToProcess[i].systemFee
                );
                _send(
                    internalParams.assetsToProcess[i].assetAddress,
                    poolData.feeCollector,
                    internalParams.assetsToProcess[i].exitFee
                );
                if (internalParams.assetsToProcess[i].assetType == 1) {
                    (bool status, bytes memory returnData) = poolData.factory.getLiquidityProvisionLib()
                        .delegatecall(
                            abi.encodeWithSignature("exitWithoutEvent(address,address,address,address,address,uint256,uint256,address)",
                                poolData.factory,
                                address(this),
                                (msg.sender),
                                convertToTokenAddress,
                                internalParams.assetsToProcess[i].assetAddress,
                                internalParams.assetsToProcess[i].balanceNative,
                                1,
                                poolData.factory.getRouterAddress(
                                    internalParams.assetsToProcess[i].assetAddress
                                )
                            )
                    );
                    if (!status) revert IPool.BadERC20CallResult();
                    internalParams.totalAmount += abi.decode(returnData, (uint256));
                } else if (internalParams.assetsToProcess[i].assetType == 2) {
                    bool status;
                    bytes memory returnData;
                    (status, returnData) = poolData
                        .factory
                        .getLendBorrowLibraryAddress()
                        .delegatecall(
                            abi.encodeWithSignature(
                                "_venusRedeem(address,address,address,uint256)",
                                address(poolData.factory),
                                address(this),
                                internalParams.assetsToProcess[i].assetAddress,
                                internalParams.assetsToProcess[i].balanceNative
                            )
                        );
                    if (!status) revert IPool.BadERC20CallResult();
                    (
                        internalParams.underlyingAsset,
                        internalParams.redeemedAmount
                    ) = abi.decode(returnData, (address, uint256));

                    (status, returnData) = internalParams
                        .convertLibrary
                        .delegatecall(
                            abi.encodeWithSignature(
                                "convertTokenToToken(address,address,address,address,uint256,uint256)",
                                internalParams.storageContract,
                                msg.sender,
                                internalParams.underlyingAsset,
                                convertToTokenAddress,
                                internalParams.redeemedAmount,
                                1
                            )
                        );
                    if (!status) revert IPool.BadLendCallResult();
                    internalParams.totalAmount += abi.decode(
                        returnData,
                        (uint256)
                    );
                } else if (internalParams.assetsToProcess[i].assetType == 0) {
                    (bool status, bytes memory returnData) = internalParams
                        .convertLibrary
                        .delegatecall(
                            abi.encodeWithSignature(
                                "convertTokenToToken(address,address,address,address,uint256,uint256)",
                                internalParams.storageContract,
                                msg.sender,
                                internalParams.assetsToProcess[i].assetAddress,
                                convertToTokenAddress,
                                internalParams.assetsToProcess[i].balanceNative,
                                1
                            )
                        );
                    if (!status) revert IPool.BadERC20CallResult();
                    internalParams.totalAmount += abi.decode(
                        returnData,
                        (uint256)
                    );
                }
            }
            unchecked {
                ++i;
            }
        }
        internalParams.withdrawnInUSD = IPoolLibrary(
            poolData.factory.getPoolLibraryAddress()
        ).getAmtInToken(
                address(poolData.factory),
                convertToTokenAddress,
                USDT_ADDRESS,
                internalParams.totalAmount
            );
        analytics[address(0)].withdrawnInUSD += internalParams.withdrawnInUSD;
        analytics[msg.sender].withdrawnInUSD += internalParams.withdrawnInUSD;
        if (internalParams.totalAmount < minAmount) revert IPool.InsufficientFunds();
        IFactory(poolData.factory).generatePoolEvent(
            "Withdrawn",
            abi.encode(
                lpAmount,
                convertToTokenAddress,
                internalParams.totalAmount,
                internalParams.withdrawnInUSD
            )
        );
        _burn(msg.sender, internalParams.availableLpAmount);
        investorWithdrawTimestamp[msg.sender] = block.timestamp;
    }

    function _send(address asset, address to, uint256 amount) private {
        if (amount > 0) {
            if (asset == address(0)) {
                (bool sent, ) = to.call{value: amount}("");
                if (!sent) revert IPool.FailedToSendBNB();
            } else {
                IERC20(asset).safeTransfer(to, amount);
            }
        }
    }

    /// Only Manager

    /// @dev directCallStrategy
    /// @notice only Manager & if this option is enabled
    /// @notice call a contract with the specified data
    /// @param calls struct with contract address and call data

    function directCallStrategy(
        IPool.Call[] calldata calls
    )
        external
        onlyManager
        returns (uint256 blockNumber, bytes[] memory returnData)
    {
        if (!poolData.directCallAllowed) revert IPool.DirectCallNotAllowed();
        blockNumber = block.number;
        returnData = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ) {
            // require(factory.isPlatformSupported(calls[i].target), "Platform not supported");
            (bool status, bytes memory result) = calls[i].target.call(
                calls[i].callData
            );

            if (!status) revert IPool.BadDirectCallStrategy();

            returnData[i] = result;
            unchecked {
                ++i;
            }
        }
    }

    /// @dev libraryCall
    /// @notice only Manager & Library address is contains
    /// @notice call library contract with data by delegatecall
    /// @param lib library address
    /// @param data call data

    function libraryCall(
        address lib,
        bytes calldata data
    ) external onlyManager {
        IFactory factory = IFactory(poolData.factory);
        if (!(supportedPlatforms.contains(lib) && factory.isLibrarySupported(lib))) revert IPool.NotSupportedPlatform();

        if (lib == factory.getLiquidityProvisionLib()) {
            (address uniswapV2In, ) = poolData.factory.getUniAddresses();
            if (!supportedPlatforms.contains(uniswapV2In)) 
                revert IPool.NotSupportedPlatform();
        }

        (bool status, bytes memory result) = lib.delegatecall(data);
        if (!status) revert IPool.BadLibraryCall();

        if (lib == factory.getFuturesLib()) {
            if (
                keccak256(
                    abi.encodeWithSignature(
                        "placeMarketOrder(address,uint8,uint8,uint8,address,address,bytes,uint256)"
                    )
                ) == keccak256(bytes(data[0:4]))
            ) {
                bytes32 key = keccak256(result);
                if (!uniqFutureData.contains(key)) {
                    uniqFutureData.add(key);
                    placeOrderResponses.push(abi.decode(result, (bytes)));
                }
            }
            factory.generatePoolEvent("Futures", data);
        }
    }

    /**
    @notice add new or remove old investors to listOfInvestors
    @notice will only be applied if the pool is private
    @param listOfInvestors array of new investors
    @param action - if 'true' - add, if 'false' - remove
    */
    function manageInvestors(
        address[] memory listOfInvestors,
        bool action
    ) external onlyManager {
        if (poolData.privacyStatus) {
            if (action) {
                for (uint24 i = 0; i < listOfInvestors.length; ) {
                    investorAddresses.add(listOfInvestors[i]);
                    unchecked {
                        ++i;
                    }
                }
            } else {
                for (uint24 i = 0; i < listOfInvestors.length; ) {
                    investorAddresses.remove(listOfInvestors[i]);
                    unchecked {
                        ++i;
                    }
                }
            }
        }
    }

    /**
    @notice set direct call allowance
    @param action true or false
    */

    function setDirectCallAllowance(bool action) external onlyManager {
        poolData.directCallAllowed = action;
    }

    /**
    @notice set publish pool status
    @param newStatus new status
    */
    function setPublishStatus(bool newStatus) external onlyManager {
        poolData.published = newStatus;
    }

    /**
    @notice close pool for use
    */

    function closePool() external onlyManager onlyOpenPool {
        poolData.isClose = true;
    }

    /**
    @notice setMinMaxInvestmentAmount - sets a minimum and maximum amount below or above which investments cannot be made
    @param newMinInvestmentAmount new min amount
    @param newMaxInvestmentAmount new max amount
    */

    function setMinMaxInvestmentAmount(
        uint256 newMinInvestmentAmount,
        uint256 newMaxInvestmentAmount
    ) external onlyManager {
        if(newMaxInvestmentAmount < newMinInvestmentAmount) revert IPool.MaxDepositLessMinDeposit();
        poolData.minInvestmentAmount = newMinInvestmentAmount;
        poolData.maxInvestmentAmount = newMaxInvestmentAmount;
    }

    /**
    @notice setEntryExitFee - sets entry and exit fee
    @param entryFee new entry fee
    @param exitFee new exit fee
    */
    function setEntryExitFee(
        IPool.Fee memory entryFee,
        IPool.Fee memory exitFee
    ) external onlyManager{
        poolData.entryFee = entryFee;
        poolData.exitFee = exitFee;
    }

    /**
    @notice setFeeCollectorAndFee - sets new fee collector and fee percentage
    @param newFeeCollector new fee collector
    @param newFeePercentage new fee percentage
    */

    function setFeeCollectorAndFee(
        address newFeeCollector,
        uint24 newFeePercentage
    ) external onlyManager {
        poolData.feeCollector = newFeeCollector;
        poolData.feePercentage = newFeePercentage;
    }

    /**
    @notice setAutoSwap - sets the mode of the auto swap feature and the auto swap token
    @param isAutoSwapOn_ true - auto swap is on, false auto swap is off
    @param autoSwapToken_ auto swap token address
    */

    function setAutoSwap(
        bool isAutoSwapOn_,
        address autoSwapToken_
    ) external onlyManager {
        if (!supportedAssets.contains(autoSwapToken_)) revert IPool.NotSupportedToken();
        poolData.autoSwap.isAutoSwapOn = isAutoSwapOn_;
        poolData.autoSwap.autoSwapToken = autoSwapToken_;
    }

    function setSupportedLiquidityPairs(
        bool action,
        address pairAddress,
        uint256 lpAmount
    ) external {
        if (msg.sender != address(this)) 
            revert IPool.NotSupportedPlatform();
        if (action){
            supportedLiquidityPairs.add(pairAddress);
        }
        else{
            if (IERC20(pairAddress).balanceOf(address(this)) - lpAmount == 0)
                supportedLiquidityPairs.remove(pairAddress);
        }
    }

    /// View methods

    /**
    @notice getFeeCollected - get amount of fee
    */

    // function getFeeCollected() external view returns (uint256) {
    //     return ((analytics[address(0)].withdrawnInUSD *
    //         ONE_HUNDRED_WITH_ACCURACY) /
    //         (ONE_HUNDRED_WITH_ACCURACY - poolData.feePercentage)) - analytics[address(0)].withdrawnInUSD;
    // }

    /**
    @notice checkUnderlyingTokens - check pairs for pancakeswap
    */


    /**
    @notice getFactoryAddress
    */

    function getFactoryAddress() external view returns (address) {
        return address(poolData.factory);
    }

    /**
    @notice getFeePercentage
    */

    function getFeePercentage() external view returns (uint24) {
        return poolData.feePercentage;
    }

    /**
    @notice get entry and exit fee
    */

    function getEntryExitFee() external view returns (IPool.Fee memory, IPool.Fee memory) {
        return (poolData.entryFee, poolData.exitFee);
    }

    function getSupportLiquidityPairs()
        external
        view
        returns (address[] memory)
    {
        return supportedLiquidityPairs.values();
    }

    /**
    @notice The function of calculating all the assets of this pool
    @return struct of (address of asset; balance of pool address)
    */
    function assetsUnderManagement()
        public
        view
        returns (IPool.AssetBalances[] memory)
    {
        address venusLibrary = poolData.factory.getVenusLibraryData();

        address[] memory supportedLendsBorrows;
        if (venusLibrary != address(0)) {
            address[] memory lendsBorrowsArray = IVenusLibrary(venusLibrary)
                .getEnteredAssets(address(this));
            supportedLendsBorrows = lendsBorrowsArray;
        }

        IPool.AssetBalances[] memory assetsBalances = new IPool.AssetBalances[](
            supportedAssets.length() +
                supportedLiquidityPairs.length() +
                (supportedLendsBorrows.length * 2)
        );
        address token;
        uint16 j = 0;

        for (uint16 i; i < supportedLiquidityPairs.length(); ) {
            token = supportedLiquidityPairs.at(i);
            assetsBalances[j] = IPool.AssetBalances(
                token,
                IERC20(token).balanceOf(address(this)),
                IPool.AssetType.LPTOKEN
            );
            unchecked {
                ++j;
                ++i;
            }
        }

        for (uint16 i; i < supportedAssets.length(); ) {
            token = supportedAssets.at(i);
            assetsBalances[j] = IPool.AssetBalances(
                token,
                token != address(0)
                    ? IERC20(token).balanceOf(address(this))
                    : address(this).balance,
                IPool.AssetType.ERC20
            );
            unchecked {
                ++j;
                ++i;
            }
        }

        for (uint16 i; i < supportedLendsBorrows.length; ) {
            assetsBalances[j] = IPool.AssetBalances(
                supportedLendsBorrows[i],
                IERC20(supportedLendsBorrows[i]).balanceOf(address(this)),
                IPool.AssetType.LEND
            );
            assetsBalances[j + 1] = IPool.AssetBalances(
                supportedLendsBorrows[i],
                IVenusLibrary(venusLibrary).getBorrowBalanceStored(
                    supportedLendsBorrows[i],
                    address(this)
                ),
                IPool.AssetType.BORROW
            );
            unchecked {
                j += 2;
                ++i;
            }
        }

        return assetsBalances;
    }

    /**
    @return complete information about the this pool
    */
    function poolInfo() external view returns (IPool.PoolDetails memory) {
        PoolData memory pool = poolData;

        return
            IPool.PoolDetails(
                address(this),
                pool.manager,
                name(),
                symbol(),
                pool.privacyStatus,
                pool.published,
                pool.isClose,
                0,
                assetsUnderManagement(),
                pool.lockTimeInSec
            );
    }


    function getInvestors() external view returns (address[] memory) {
        return investorAddresses.values();
    }

    function getSupportedAssetsAndPlatforms()
        external
        view
        returns (address[] memory, address[] memory)
    {
        return (supportedAssets.values(), supportedPlatforms.values());
    }

    function getPlaceOrderResponses() external view returns (bytes[] memory) {
        return placeOrderResponses;
    }

    function isSupportedAsset(address asset) external view returns (bool) {
        return supportedAssets.contains(asset);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal view override {
        to;
        amount;
        if (
            from != address(0) &&
            investorLockPeriod[from] > uint32(block.timestamp)
        ) {
            revert IPool.YourTokensAreLocked();
        }
    }
}
