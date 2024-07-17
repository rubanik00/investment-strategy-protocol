// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IPoolLibrary.sol";

import "./RevertReasonParser.sol";

library LendBorrowLibrary {
    function venusDeposit(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) external {
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        address underlyingAsset = IVenusLibrary(venusLibrary)
            .getUnderlyingAsset(vTokenMarket);

        require(
            IPool(pool).isSupportedAsset(underlyingAsset),
            "Not supported token."
        );

        (bool status, bytes memory result) = venusLibrary.delegatecall(
            abi.encodeWithSignature(
                "enterAndSupplyMarket(address,uint256)",
                vTokenMarket,
                amount
            )
        );
        require(status, RevertReasonParser.parse(result, "venusDeposit: "));

        IFactory(factory).generatePoolEvent(
            "Lend",
            abi.encode(
                amount,
                vTokenMarket,
                underlyingAsset,
                IPoolLibrary(IFactory(factory).getPoolLibraryAddress())
                    .getAmtInToken(
                        factory,
                        underlyingAsset,
                        0x55d398326f99059fF775485246999027B3197955,
                        amount
                    )
            )
        );
    }

    function venusBorrow(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) external {
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        address underlyingAsset = IVenusLibrary(venusLibrary)
            .getUnderlyingAsset(vTokenMarket);

        require(
            IPool(pool).isSupportedAsset(underlyingAsset),
            "Not supported token."
        );

        (bool status, bytes memory result) = venusLibrary.delegatecall(
            abi.encodeWithSignature(
                "borrow(address,uint256)",
                vTokenMarket,
                amount
            )
        );
        require(status, RevertReasonParser.parse(result, "venusBorrow: "));

        IFactory(factory).generatePoolEvent(
            "Borrow",
            abi.encode(
                amount,
                vTokenMarket,
                underlyingAsset,
                IPoolLibrary(IFactory(factory).getPoolLibraryAddress())
                    .getAmtInToken(
                        factory,
                        underlyingAsset,
                        0x55d398326f99059fF775485246999027B3197955,
                        amount
                    )
            )
        );
    }

    function venusRepay(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) external {
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        address underlyingAsset = IVenusLibrary(venusLibrary)
            .getUnderlyingAsset(vTokenMarket);

        require(
            IPool(pool).isSupportedAsset(underlyingAsset),
            "Not supported token."
        );

        (bool status, bytes memory result) = venusLibrary.delegatecall(
            abi.encodeWithSignature(
                "repayBorrow(address,uint256)",
                vTokenMarket,
                amount
            )
        );
        require(status, RevertReasonParser.parse(result, "venusRepay: "));

        IFactory(factory).generatePoolEvent(
            "Repay",
            abi.encode(
                amount,
                vTokenMarket,
                underlyingAsset,
                IPoolLibrary(IFactory(factory).getPoolLibraryAddress())
                    .getAmtInToken(
                        factory,
                        underlyingAsset,
                        0x55d398326f99059fF775485246999027B3197955,
                        amount
                    )
            )
        );
    }

    function venusRedeem(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) external returns (address, uint256) {
        return _venusRedeem(factory, pool, vTokenMarket, amount);
    }

    function _venusRedeem(
        address factory,
        address pool,
        address vTokenMarket,
        uint256 amount
    ) public returns (address, uint256) {
        address underlyingAsset = IVenusLibrary(
            IFactory(factory).getVenusLibraryData()
        ).getUnderlyingAsset(vTokenMarket);

        require(
            IPool(pool).isSupportedAsset(underlyingAsset),
            "Not supported token."
        );

        (bool status, bytes memory returnData) = address(
            IFactory(factory).getVenusLibraryData()
        ).delegatecall(
                abi.encodeWithSignature(
                    "redeemTokensAmountReturn(address,uint256)",
                    vTokenMarket,
                    amount
                )
            );
        require(status, RevertReasonParser.parse(returnData, "venusRedeem: "));

        IFactory(factory).generatePoolEvent(
            "Redeem",
            abi.encode(
                amount,
                vTokenMarket,
                underlyingAsset,
                IPoolLibrary(IFactory(factory).getPoolLibraryAddress())
                    .getAmtInToken(
                        factory,
                        underlyingAsset,
                        0x55d398326f99059fF775485246999027B3197955,
                        amount
                    )
            )
        );

        return (underlyingAsset, abi.decode(returnData, (uint256)));
    }

    function venusClaim(
        address factory,
        address pool,
        address[] calldata vTokenMarkets
    ) external {
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        for (uint16 i; i < vTokenMarkets.length; ) {
            require(
                IPool(pool).isSupportedAsset(
                    IVenusLibrary(venusLibrary).getUnderlyingAsset(
                        vTokenMarkets[i]
                    )
                ),
                "Not supported token."
            );
            unchecked {
                ++i;
            }
        }

        (bool status, bytes memory returnData) = venusLibrary.delegatecall(
            abi.encodeWithSignature(
                "claimXVSForAllMarkets(address[])",
                vTokenMarkets
            )
        );
        require(status, RevertReasonParser.parse(returnData, "venusRedeem: "));
    }
}
