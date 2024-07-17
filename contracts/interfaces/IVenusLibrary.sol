// SPDX-License-Identifier: GPLv2

pragma solidity 0.8.19;

interface IVenusLibrary {
    function getUnderlyingAsset(
        address vTokenMarket
    ) external view returns (address);

    function vTokenBalance(
        address vTokenMarket,
        address account
    ) external view returns (uint);

    function getBorrowBalanceStored(
        address vTokenMarket,
        address account
    ) external view returns (uint256);

    function getEnteredAssets(
        address account
    ) external view returns (address[] memory);

    function calculateSuppliedValue(
        address vTokenMarket,
        address account
    ) external view returns (uint256);

    function calculateSuppliedValueAmount(
        address vTokenMarket,
        uint256 amount
    ) external view returns (uint256);

    function getBorrowedPercentage(
        address account
    ) external view returns (uint256 percentage);
}
