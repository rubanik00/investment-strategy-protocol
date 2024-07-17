// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IDexEstimateLibrary {
    struct AssetBalances {
        address assetAddress;
        uint256 balance;
    }

    struct ConversionOptions {
        uint256 directAmount;
        uint256 intermediateAmount;
    }

    function estimateTokenToEth(
        address _storageAddress,
        address _fromToken,
        uint256 _amount
    ) external view returns (uint256);

    function estimateArrayOfTokenToToken(
        address _storageAddress,
        AssetBalances[] memory _fromTokens,
        address _toToken
    ) external view returns (uint256);

    function estimateTokenToToken(
        address _storageAddress,
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) external view returns (uint256);

    function getConversionOptions(
        address[] memory routers,
        address fromToken,
        address toToken,
        uint256 amount
    )
        external
        view
        returns (
            address[] memory directPath,
            address[] memory intermadiatePath,
            IDexEstimateLibrary.ConversionOptions[] memory amounts
        );
}
