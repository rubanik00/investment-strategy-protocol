// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library DexConvertLibrary {
    function convertArrayOfTokensToTokenLimited(
        address _storageAddress,
        address[] memory _tokens,
        uint256[] memory _amounts,
        address _convertToToken,
        address _toWhomToIssue,
        uint256 _minTokensRec
    ) public returns (uint256) {
        _storageAddress;
        _tokens;
        _amounts;
        _convertToToken;
        _toWhomToIssue;
        _minTokensRec;
        return 10;
    }

    function convertTokenToToken(
        address _storageAddress,
        address payable _toWhomToIssue,
        address _fromToken,
        address _toToken,
        uint256 _amount,
        uint256 _minOutputAmount
    ) public returns (uint256) {
        _storageAddress;
        _toWhomToIssue;
        _fromToken;
        _toToken;
        _amount;
        _minOutputAmount;
        return 20;
    }
}
