// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IPool.sol";

interface ILiquidityProvisionLibrary {

    function enter(
        address factory,
        address pool,
        IPool.EnterParams calldata params
    ) external;

    function exit(
        address factory_,
        address pool, 
        address toWhomToIssue,
        address toToken,
        address pairAddress,
        uint256 lpAmount,
        uint256 minReceiveAmount,
        address exchangeRouterAddress
    ) external returns(uint256);

}