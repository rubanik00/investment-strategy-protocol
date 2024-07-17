// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IOrderManager {
    enum UpdatePositionType {
        INCREASE,
        DECREASE
    }

    enum OrderType {
        MARKET,
        LIMIT
    }

    enum Side {
        LONG,
        SHORT
    }

    function placeOrder(
        UpdatePositionType _updateType,
        Side _side,
        address _indexToken,
        address _collateralToken,
        OrderType _orderType,
        bytes calldata data
    ) external payable;

    function cancelOrder(uint256 _orderId) external;

    function getOrders(
        address user,
        uint256 skip,
        uint256 take
    ) external view returns (uint256[] memory orderIds, uint256 total);
}