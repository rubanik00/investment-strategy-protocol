// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ILevelOracle {
  function getPrice(address token, bool max) external view returns (uint256);
  function getMultiplePrices(address[] calldata tokens, bool max) external view returns (uint256[] memory);
  function getLastPrice(address token) external view returns (uint256 lastPrice);
}