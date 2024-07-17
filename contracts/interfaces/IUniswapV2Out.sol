// SPDX-License-Identifier: GPLv2

pragma solidity 0.8.19;

interface IUniswapV2Out {
    struct SwapOptions {
        address fromToken;
        address toToken;
        address[] routers;
        address[][] paths;
    }

    function exit(
        address payable _toWhomToIssue,
        address _ToTokenContractAddress,
        address _FromUniPoolAddress,
        uint256 _IncomingLP,
        uint256 _minTokensRec,
        address _exchangeRouter
    ) external returns (uint256);

    function estimateLiquidityValue(
        address lpToken,
        uint256 lpAmount,
        address estimateInToken
    ) external view returns (uint256);
}
