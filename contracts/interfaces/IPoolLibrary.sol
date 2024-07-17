// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IPool.sol";

interface IPoolLibrary {
    function withdrawEstimation(
        address factory,
        address pool,
        uint256 lpAmount,
        address convertToTokenAddress
    )
        external
        view
        returns (
            IPool.WithdrawAssetBalances[] memory,
            uint256 availableLpAmount
        );

    function getAmtInToken(
        address factory,
        address fromToken,
        address toToken,
        uint256 amount
    ) external view returns (uint256);

    function getAssetAmountsToToken(
        address factory,
        address pool,
        address token
    ) external view returns (uint256 amountInToken);

    function estimateLpAmount(
        address factory,
        address pool,
        address token,
        uint256 investAmount,
        bool externalCall
    ) external view returns (uint256);

    function metadata(
        address factory,
        address pool,
        address manager
    ) external view returns (string memory);

    function calculateFee(
        uint32 fee,
        uint256 value
    ) external pure returns (uint256);

    function convertWithPredefinedPath(
        address factory,
        uint256 _amount,
        uint256 _minOutputAmount,
        address[] memory _routers,
        address[][] memory paths
    ) external;

    function convertArrayOfTokensToTokenLimited(
        address factory,
        address[] memory _tokens,
        uint256[] memory _amounts,
        address _convertToToken,
        uint256 _minTokensRec
    ) external;
}
