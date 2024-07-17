// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ILevelPool {
  struct Position {
    /// @dev contract size is evaluated in dollar
    uint256 size;
    /// @dev collateral value in dollar
    uint256 collateralValue;
    /// @dev contract size in indexToken
    uint256 reserveAmount;
    /// @dev average entry price
    uint256 entryPrice;
    /// @dev last cumulative interest rate
    uint256 borrowIndex;
}

  function positions(bytes32 key) external view returns (Position memory);
}