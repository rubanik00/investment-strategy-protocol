// SPDX-License-Identifier: GPLv2

pragma solidity 0.8.19;

interface IUniswapV2Pair {
    function token0() external pure returns (address);

    function token1() external pure returns (address);
}
