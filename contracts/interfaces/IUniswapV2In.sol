// SPDX-License-Identifier: GPLv2

pragma solidity 0.8.19;

interface IUniswapV2In {
    struct SwapOptions {
        address fromToken;
        address toToken;
        address[] routers;
        address[][] paths;
    }

    function inViaTokens(
        address _toWhomToIssue,
        address _FromTokenContractAddress,
        address _ToUnipoolToken0,
        address _ToUnipoolToken1,
        uint256 _amount,
        uint256 _minPoolTokens,
        address _exchangeRouter,
        SwapOptions[] memory _swapOptions
    ) external payable returns (uint256);

    function enter(
        address _toWhomToIssue,
        address _fromTokenAddress,
        address _toPairAddress,
        uint256 _amount,
        uint256 _minPoolTokens,
        address _exchangeRouter,
        SwapOptions[] calldata _swapOptions
    ) external payable returns (uint256);
}
