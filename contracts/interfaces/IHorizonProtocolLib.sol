// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IHorizonProtocolLib {
    struct Balances {
        bytes32 currencyKey;
        address underlyingAddress;
        uint256 lpBalance;
        uint256 lpValue;
        bool suspended;
        uint248 suspendReason;
    }

    function exchangeTokenToProduct(
        address factory,
        address sourceToken,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        uint256 minOutputAmount
    ) external returns (uint256 amountReceived);

    function exchangeProductToProduct(
        address sourceCurrencyAddress,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external returns (uint amountReceived);

    function exchangeZusdProductToToken(
        address factory,
        address toWhomToIssue,
        uint256 sourceAmount,
        address destinationToken,
        uint256 minOutputAmount
    ) external returns (uint amountReceived);

    function getPortfolioValueInZusdDefaultList(
        address user
    ) external view returns (uint256);

    function getPortfolioDefaultList(
        address factory,
        address user,
        address estimateInToken
    ) external view returns (Balances[] memory);

    function getPortfolioDefaultProductsValueInZusdCustomList(
        address user
    ) external view returns (address[] memory underlyingAsset, uint256[] memory totalValue);
}
