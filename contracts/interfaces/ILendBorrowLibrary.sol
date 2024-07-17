// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ILendBorrowLibrary {
    function _venusRedeem(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) external returns (address, uint256);
}
