// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IDexEstimateLibrary.sol";
import "./IUniswapV2In.sol";
import "./IUniswapV2Out.sol";
import "./IUniswapV2Pair.sol";
import "./IVenusLibrary.sol";

interface IPool {
    enum AssetType {
        ERC20,
        LPTOKEN,
        LEND,
        BORROW,
        FUTURE,
        SYNTHETIC
    }

    struct EnterParams {
        address fromToken;
        address pairAddress;
        uint256 amount;
        uint256 minReceiveAmount;
        address exchangeRouterAddress;
        IUniswapV2In.SwapOptions[] swapOptions;
    }

    struct WithdrawEstimationInternalParams {
        uint24 systemFeePercentage;
        address uniswapV2Out;
        address venusLibrary;
        uint256 withdrawAmt;
        uint256 convertedAmt;
        uint256 performanceFee;
        uint256 systemFee;
        uint256 exitFee;
    }

    struct WithdrawInternalParams {
        address underlyingAsset;
        address treasuryAddress;
        address storageContract;
        address convertLibrary;
        uint256 redeemedAmount;
        uint256 withdrawnInUSD;
        uint256 totalAmount;
        uint256 availableLpAmount;
        WithdrawAssetBalances[] assetsToProcess;
    }

    struct Analytics {
        uint256 investedInUSD;
        uint256 withdrawnInUSD;
    }

    struct Call {
        address target;
        bytes callData;
    }

    struct AssetBalances {
        address assetAddress;
        uint256 balance;
        AssetType assetType;
    }

    struct PoolDetails {
        address poolAddress;
        address manager;
        string name;
        string symbol;
        bool privacyStatus;
        bool published;
        bool isClose;
        uint256 risk;
        AssetBalances[] assetsBalances; //assetsUnderManagement();
        uint32 lockPeriodInSec;
    }

    struct Fee {
        bool isFixedAmount;
        uint256 feeAmount;
    }

    struct AutoSwap{
        bool isAutoSwapOn;
        address autoSwapToken;
    }

    struct PoolParams {
        uint24 feePercentage;
        uint32 lockPeriodInSec;
        uint32 frequency;
        bool privacyStatus;
        bool published;
        string name;
        string symbol;
        address feeCollector;
        address manager;
        address[] supportedAssets;
        address[] supportedPlatforms;
        address[] whitelistedUsers;
        address[] redemptionSupportedAssets;
        uint256 risk;
        uint256 minInvestmentAmount;
        uint256 maxInvestmentAmount;
        Fee entryFee;
        Fee exitFee;
        AutoSwap autoSwap;
    }

    struct WithdrawAssetBalances {
        uint8 assetType;
        address assetAddress;
        uint256 balanceNative;
        uint256 performanceFee;
        uint256 systemFee;
        uint256 exitFee;
        uint256 balanceConverted;
    }

    error CallerIsNotManager();
    error NotSupportedToken();
    error NotSupportedPlatform();
    error NotOnTheListOfInvestors();
    error InsufficientFunds();
    error FailedToSendBNB();
    error YourTokensAreLocked();
    error LessOrGreaterThanAllowedValue();
    error PooLIsClose();
    error EntryFeeIsGreaterThanInvestAmount();
    error BadLendCallResult();
    error BadERC20CallResult();
    error DirectCallNotAllowed();
    error IncorrectInvestValue();
    error BadLibraryCall();
    error BadDirectCallStrategy();
    error MaxDepositLessMinDeposit();
    error RedemptionWindowClosed();

    function initialize(PoolParams memory poolParams) external;

    function poolInfo() external view returns (PoolDetails memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function assetsUnderManagement()
        external
        view
        returns (IPool.AssetBalances[] memory);

    function getFeePercentage() external view returns (uint24);

    function getFactoryAddress() external view returns (address);

    function getPlaceOrderResponses() external view returns (bytes[] memory);

    function isSupportedAsset(address asset) external view returns (bool);

    function getEntryExitFee() external view returns (IPool.Fee memory, IPool.Fee memory);
    function setSupportedLiquidityPairs(
        bool action,
        address pairAddress,
        uint256 lpAmount
    ) external;
}
