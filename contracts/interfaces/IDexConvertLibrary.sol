// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IDexConvertLibrary {
    function convertArrayOfTokensToTokenLimited(
        address _storageAddress,
        address[] memory _tokens,
        uint256[] memory _amounts,
        address _convertToToken,
        address _toWhomToIssue,
        uint256 _minTokensRec
    ) external returns (uint256);

    function convertTokenToToken(
        address _storageAddress,
        address payable _toWhomToIssue,
        address _fromToken,
        address _toToken,
        uint256 _amount,
        uint256 _minOutputAmount
    ) external returns (uint256);

    function convertWithPredefinedPath(
        uint256 _amount,
        uint256 _minOutputAmount,
        address _toWhomToIssue,
        address[] memory _routers,
        address[][] memory paths
    ) external returns (uint256);

}
