// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/ILevelPool.sol";

interface IFuturesLib {
    function getPositions(
        bytes[] memory keysRaw
    )
        external
        view
        returns (
            ILevelPool.Position[] memory positions,
            address[] memory indexTokens,
            uint256[] memory indexTokensValue,
            int256[] memory pnls,
            uint256 totalValue
        );
}
