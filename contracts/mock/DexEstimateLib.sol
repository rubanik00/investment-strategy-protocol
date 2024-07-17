// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library DexEstimateLibrary {
    struct AssetBalances {
        address assetAddress;
        uint256 balance;
    }

    function estimateTokenToEth(
        address _storageAddress,
        address _fromToken,
        uint256 _amount
    ) public view returns (uint256) {
        _storageAddress;
        _fromToken;
        _amount;
        return
            _fromToken != address(0)
                ? (_amount * 1 ether) / (300 * 1 ether)
                : _amount;
    }

    function estimateTokenToToken(
        address _storageAddress,
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public view returns (uint256) {
        _storageAddress;
        _fromToken;
        _toToken;
        _amount;
        return
            _fromToken != address(0)
                ? (_amount * 1 ether) / (300 * 1 ether)
                : _amount;
    }

    function estimateArrayOfTokenToToken(
        address _storageAddress,
        AssetBalances[] memory _fromTokens,
        address _toToken
    ) public view returns (uint256) {
        _storageAddress;
        _fromTokens;
        _toToken;
        return 0;
    }
}
