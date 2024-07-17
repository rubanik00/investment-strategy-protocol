// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IDexEstimateLibrary.sol";
import "./IUniswapV2In.sol";
import "./IUniswapV2Out.sol";
import "./IUniswapV2Pair.sol";
import "./IVenusLibrary.sol";

import "./IPool.sol";

interface IPersonalPool {

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
        uint256 systemFee;
    }

    struct WithdrawInternalParams {
        address underlyingAsset;
        address treasuryAddress;
        address storageContract;
        address convertLibrary;
        uint256 systemFee;
        uint256 redeemedAmount;
        uint256 withdrawnInUSD;
        uint256 totalAmount;
    }

    struct PersonalPoolDetails {
        address poolAddress;
        address manager;
        bool isClose;
        uint256 risk;
        IPool.AssetBalances[] assetsBalances; //assetsUnderManagement();
    }

    struct PersonalPoolParams {
        address manager;
        address[] supportedAssets;
        address[] supportedPlatforms;
    }

    error CallerIsNotManager();
    error NotSupportedToken();
    error NotOnTheListOfInvestors();
    error InsufficientFunds();
    error FailedToSendBNB();
    error YourTokensAreLocked();
    error LessThanMinimumValue();
    error PooIsClose();

    function initialize(PersonalPoolParams memory poolParams) external;

    function poolInfo() external view returns (PersonalPoolDetails memory);
}