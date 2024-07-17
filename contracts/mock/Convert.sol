// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IFactory.sol";
import "../interfaces/IVenusLibrary.sol";

contract Convert {
    IFactory public factory; // address of factory

    constructor(address _factory) {
        factory = IFactory(_factory);
    }

    // FOR TEST
    function convert(
        address[] memory tokens,
        uint256[] memory amounts,
        address rewardToken
    ) external payable {
        bool status;
        bytes memory result;
        (address storageContract, , address convertLabrary) = factory
            .getDexLibraryData();
        (status, result) = convertLabrary.delegatecall(
            abi.encodeWithSignature(
                "convertArrayOfTokensToTokenLimited(address,address[],uint256[],address,address,uint256)",
                storageContract,
                tokens,
                amounts,
                rewardToken,
                msg.sender,
                1
            )
        );
        require(status, "Error!!");
    }

    function getVBalance(
        address vTokenMarket,
        address account
    ) external view returns (uint256) {
        address venusLibrary = factory.getVenusLibraryData();
        uint256 balance = IVenusLibrary(venusLibrary).vTokenBalance(
            vTokenMarket,
            account
        );

        return balance;
    }

    function getBorrowedBalance(
        address vTokenMarket,
        address account
    ) external view returns (uint256) {
        address venusLibrary = factory.getVenusLibraryData();
        uint256 balance = IVenusLibrary(venusLibrary).getBorrowBalanceStored(
            vTokenMarket,
            account
        );

        return balance;
    }

    function getBorrowedPercentage(
        address pool
    ) external view returns (uint256) {
        address venusLibrary = factory.getVenusLibraryData();
        return IVenusLibrary(venusLibrary).getBorrowedPercentage(pool);
    }

    function calculateFee(
        uint256 fee,
        uint256 value
    ) public pure returns (uint256) {
        if (fee == 0) return 0;
        return (value * fee) / 100000;
    }
}
