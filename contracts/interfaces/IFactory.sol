// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IPool.sol";

interface IFactory {
    enum PoolType {
        POOL,
        PERSONAL_POOL
    }

    struct InitialParams {
        uint24 fee;
        address treasuryFund;
        address storageContract;
        address dexConvert;
        address dexEstimate;
        address poolLogic;
        address poolLibrary;
        address liquidityProvisionLibrary;
        address personalPoolLogic;
        address lendBorrowLibrary;
        address futuresLibrary;
        address networkNativeToken;
        address uniswapV2In;
        address uniswapV2Out;
        address venusContract;
        address horizonProtocolLib;
        address[] whitelistedAssets;
        address[] whitelistedPlatforms;
        string baseUri;
    }

    struct Pool {
        bool privacyStatus;
        bool published;
        uint32 lockPeriodInSec;
        uint32 frequency;
        uint24 feePercentage;
        string name;
        string symbol;
        address feeCollector;
        address[] supportedAssets;
        address[] supportedPlatforms;
        address[] whitelistedUsers;
        address[] redemptionSupportedAssets;
        uint256 risk;
        uint256 minInvestmentAmount;
        uint256 maxInvestmentAmount;
        IPool.Fee entryFee;
        IPool.Fee exitFee;
        IPool.AutoSwap autoSwap;
    }

    struct PersonalPool {
        address[] supportedAssets;
        address[] supportedPlatforms;
    }

    function saveLiquidityToRouterAddress(
        address lpAddress,
        address routerAddress
    ) external;

    function getDexLibraryData()
        external
        view
        returns (
            address storageLibContract,
            address estimateContract,
            address convertContract
        );

    function getBaseUri() external view returns (string memory);

    function getTreasuryAddressAndFee() external view returns (address, uint24);

    function getUniAddresses() external view returns (address, address);

    function getRouterAddress(
        address lpAddress
    ) external view returns (address);

    function getPoolLibraryAddress() external view returns (address);

    function getLendBorrowLibraryAddress() external view returns (address);

    function generatePoolEvent(
        string calldata eventName,
        bytes calldata eventParams
    ) external;

    function getVenusLibraryData() external view returns (address);

    function getHorizonProtocolLib() external view returns (address);

    function getFuturesLib() external view returns (address);

    function getLiquidityProvisionLib() external view returns (address);
    
    function isLibrarySupported(address lib) external view returns (bool);

    function isPlatformSupported(address platform) external view returns (bool);

    function implementation(PoolType poolType) external view returns (address);
}
