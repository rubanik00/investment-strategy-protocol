// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IDexEstimateLibrary.sol";
import "../interfaces/IDexConvertLibrary.sol";
import "../interfaces/IUniswapV2Out.sol";
import "../interfaces/IVenusLibrary.sol";
import "../interfaces/IHorizonProtocolLib.sol";
import "../interfaces/IFuturesLib.sol";

import "./RevertReasonParser.sol";

library PoolLibrary {
    function convertWithPredefinedPath(
        address factory,
        uint256 _amount,
        uint256 _minOutputAmount,
        address[] memory _routers,
        address[][] memory paths
    ) external {
        (, , address convertLibrary) = IFactory(factory).getDexLibraryData();
        (bool status, bytes memory result) = convertLibrary.delegatecall(
            abi.encodeWithSignature(
                "convertWithPredefinedPath(uint256,uint256,address,address[],address[][])",
                _amount,
                _minOutputAmount,
                address(this),
                _routers,
                paths
            )
        );
        require(
            status,
            RevertReasonParser.parse(result, "convertWithPredefinedPath: ")
        );

        IFactory(factory).generatePoolEvent(
            "ConvertedArrayOfTokensToTokenWithPredefinedPath",
            abi.encode(
                paths[0][0],
                _amount,
                getAmtInToken(
                    address(factory),
                    paths[0][0],
                    0x55d398326f99059fF775485246999027B3197955,
                    _amount
                )
            )
        );
    }

    function convertArrayOfTokensToTokenLimited(
        address factory,
        address[] memory _tokens,
        uint256[] memory _amounts,
        address _convertToToken,
        uint256 _minTokensRec
    ) external {
        bool status;
        bytes memory result;
        (address storageContract, , address convertLibrary) = IFactory(factory)
            .getDexLibraryData();
        (status, result) = convertLibrary.delegatecall(
            abi.encodeWithSignature(
                "convertArrayOfTokensToTokenLimited(address,address[],uint256[],address,address,uint256)",
                storageContract,
                _tokens,
                _amounts,
                _convertToToken,
                address(this),
                _minTokensRec
            )
        );
        require(
            status,
            RevertReasonParser.parse(
                result,
                "convertArrayOfTokensToTokenLimited: "
            )
        );

        uint256 receivedTokens = abi.decode(result, (uint256));

        IFactory(factory).generatePoolEvent(
            "ConvertedArrayOfTokensToToken",
            abi.encode(
                _convertToToken,
                receivedTokens,
                getAmtInToken(
                    address(factory),
                    _convertToToken,
                    0x55d398326f99059fF775485246999027B3197955,
                    receivedTokens
                )
            )
        );
    }

    function exchangeTokenToProduct(
        address factory,
        address sourceToken,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        uint256 minOutputAmount
    ) external {
        address horizonProtocolLib = IFactory(factory).getHorizonProtocolLib();
        (bool status, bytes memory result) = horizonProtocolLib.delegatecall(
            abi.encodeWithSignature(
                "exchangeTokenToProduct(address,address,uint256,bytes32,uint256)",
                factory,
                sourceToken,
                sourceAmount,
                destinationCurrencyKey,
                minOutputAmount
            )
        );
        require(
            status,
            RevertReasonParser.parse(result, "exchangeTokenToProduct: ")
        );

        IFactory(factory).generatePoolEvent(
            "ExchangeTokenToProduct",
            abi.encode(
                sourceToken,
                sourceAmount,
                destinationCurrencyKey,
                minOutputAmount
            )
        );
    }

    function exchangeProductToProduct(
        address factory,
        address sourceCurrencyAddress,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external {
        address horizonProtocolLib = IFactory(factory).getHorizonProtocolLib();
        (bool status, bytes memory result) = horizonProtocolLib.delegatecall(
            abi.encodeWithSignature(
                "exchangeProductToProduct(address,bytes32,uint256,bytes32)",
                sourceCurrencyAddress,
                sourceCurrencyKey,
                sourceAmount,
                destinationCurrencyKey
            )
        );
        require(
            status,
            RevertReasonParser.parse(result, "exchangeProductToProduct: ")
        );

        IFactory(factory).generatePoolEvent(
            "ExchangeProductToProduct",
            abi.encode(
                sourceCurrencyAddress,
                sourceCurrencyKey,
                sourceAmount,
                destinationCurrencyKey
            )
        );
    }

    function exchangeZusdProductToToken(
        address factory,
        uint256 sourceAmount,
        address destinationToken,
        uint256 minOutputAmount
    ) external {
        address horizonProtocolLib = IFactory(factory).getHorizonProtocolLib();
        (bool status, bytes memory result) = horizonProtocolLib.delegatecall(
            abi.encodeWithSignature(
                "exchangeZusdProductToToken(address,address,uint256,address,uint256)",
                factory,
                address(this),
                sourceAmount,
                destinationToken,
                minOutputAmount
            )
        );
        require(
            status,
            RevertReasonParser.parse(result, "exchangeZusdProductToToken: ")
        );

        IFactory(factory).generatePoolEvent(
            "ExchangeZusdProductToToken",
            abi.encode(
                address(this),
                sourceAmount,
                destinationToken,
                minOutputAmount
            )
        );
    }

    function withdrawEstimation(
        address factory,
        address pool,
        uint256 lpAmount,
        address convertToTokenAddress
    )
        external
        view
        returns (
            IPool.WithdrawAssetBalances[] memory,
            uint256 availableLpAmount
        )
    {
        // // not simple balance of, but also count locked tokens...
        if (lpAmount > IPool(pool).balanceOf(tx.origin))
            revert IPool.InsufficientFunds();

        IPool.WithdrawEstimationInternalParams memory internalParams;

        (
            uint256 allAmount,
            uint256 blockedAmount
        ) = getAssetAndBlockedAmountsToToken(
                factory,
                pool,
                convertToTokenAddress
            );

        availableLpAmount = lpAmount = calculateAvailableLpAmount(
            blockedAmount,
            allAmount,
            lpAmount
        );

        IPool.AssetBalances[] memory assertsData = IPool(pool)
            .assetsUnderManagement();

        (, internalParams.systemFeePercentage) = IFactory(factory)
            .getTreasuryAddressAndFee();

        IPool.WithdrawAssetBalances[]
            memory processedAssets = new IPool.WithdrawAssetBalances[](
                assertsData.length
            );

        (, internalParams.uniswapV2Out) = IFactory(factory).getUniAddresses();
        internalParams.venusLibrary = IFactory(factory).getVenusLibraryData();

        uint256 percent = internalParams.venusLibrary != address(0)
            ? IVenusLibrary(internalParams.venusLibrary).getBorrowedPercentage(
                pool
            )
            : 0;

        if (percent > 0) {
            percent += 10000;
            if (percent > 100000) percent = 100000;
        }

        for (uint32 i; i < assertsData.length; ) {
            if (assertsData[i].assetType == IPool.AssetType.BORROW) {
                processedAssets[i] = IPool.WithdrawAssetBalances(
                    uint8(assertsData[i].assetType),
                    assertsData[i].assetAddress,
                    0,
                    0,
                    0,
                    0,
                    0
                );
            } else {
                if (assertsData[i].assetType == IPool.AssetType.LEND) {
                    if (percent > 0) {
                        assertsData[i].balance -= calculateFee(
                            percent,
                            assertsData[i].balance
                        );
                    }
                }

                internalParams.withdrawAmt =
                    (((lpAmount * 1 ether) / IPool(pool).totalSupply()) *
                        assertsData[i].balance) /
                    1 ether;
                internalParams.performanceFee = calculateFee(
                    IPool(pool).getFeePercentage(),
                    internalParams.withdrawAmt
                );
                internalParams.systemFee = calculateFee(
                    internalParams.systemFeePercentage,
                    internalParams.withdrawAmt
                ); // The amount of % will be taken from factory settings (2% for example)

                // exit fee
                ( , IPool.Fee memory exitFee) = IPool(pool).getEntryExitFee();
                internalParams.exitFee = exitFee.isFixedAmount ? 
                    getAmtInToken(
                        factory,
                        0x55d398326f99059fF775485246999027B3197955, //from USD
                        assertsData[i].assetAddress, // to withdrawen token
                        exitFee.feeAmount
                    ) // if fixed amount the value is in USD
                    : calculateFee(
                        IPool(pool).getFeePercentage(),
                        internalParams.withdrawAmt
                    );
                
                internalParams.withdrawAmt =
                    internalParams.withdrawAmt -
                    internalParams.performanceFee -
                    internalParams.systemFee;

                // need to check in case if exit fee amount is fixed
                require(internalParams.exitFee <= internalParams.withdrawAmt, "Not enought to cover exit fee"); 

                internalParams.withdrawAmt -= internalParams.exitFee;
                internalParams.convertedAmt = 0;

                if (assertsData[i].assetType == IPool.AssetType.LPTOKEN) {
                    try
                        IUniswapV2Out(internalParams.uniswapV2Out)
                            .estimateLiquidityValue(
                                assertsData[i].assetAddress,
                                internalParams.withdrawAmt,
                                convertToTokenAddress
                            )
                    {
                        internalParams.convertedAmt = IUniswapV2Out(
                            internalParams.uniswapV2Out
                        ).estimateLiquidityValue(
                                assertsData[i].assetAddress,
                                internalParams.withdrawAmt,
                                convertToTokenAddress
                            );
                    } catch Error(string memory reason) {
                        reason;
                        internalParams.convertedAmt = 0;
                    }
                } else if (assertsData[i].assetType == IPool.AssetType.LEND) {
                    address underlyingAddress = IVenusLibrary(
                        internalParams.venusLibrary
                    ).getUnderlyingAsset(assertsData[i].assetAddress);
                    internalParams.convertedAmt = getAmtInToken(
                        factory,
                        underlyingAddress,
                        convertToTokenAddress,
                        internalParams.withdrawAmt
                    );
                } else if (assertsData[i].assetType == IPool.AssetType.ERC20) {
                    internalParams.convertedAmt = getAmtInToken(
                        factory,
                        assertsData[i].assetAddress,
                        convertToTokenAddress,
                        internalParams.withdrawAmt
                    );
                }

                processedAssets[i] = IPool.WithdrawAssetBalances(
                    uint8(assertsData[i].assetType),
                    assertsData[i].assetAddress,
                    internalParams.withdrawAmt,
                    internalParams.performanceFee,
                    internalParams.systemFee,
                    internalParams.exitFee,
                    internalParams.convertedAmt
                );
            }

            unchecked {
                ++i;
            }
        }

        return (processedAssets, availableLpAmount);
    }

    function getAmtInToken(
        address factory,
        address fromToken,
        address toToken,
        uint256 amount
    ) public view returns (uint256) {
        (address storageContract, address estimateLibrary, ) = IFactory(factory)
            .getDexLibraryData();

        try
            IDexEstimateLibrary(estimateLibrary).estimateTokenToToken(
                storageContract,
                fromToken,
                toToken,
                amount
            )
        {
            return
                IDexEstimateLibrary(estimateLibrary).estimateTokenToToken(
                    storageContract,
                    fromToken,
                    toToken,
                    amount
                );
        } catch Error(string memory reason) {
            reason;
            return 0;
        }
    }

    /// returns all and blocked tokens
    function getAssetAndBlockedAmountsToToken(
        address factory,
        address pool,
        address token
    ) public view returns (uint256 amountInToken, uint256 blockedAmount) {
        IPool.AssetBalances[] memory assertsData = IPool(pool)
            .assetsUnderManagement();

        (, address uniswapV2Out) = IFactory(factory).getUniAddresses();
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        address assetToken;
        uint256 value;
        for (uint32 i; i < assertsData.length; ) {
            assetToken = assertsData[i].assetAddress;
            if (assertsData[i].assetType == IPool.AssetType.LPTOKEN) {
                try
                    IUniswapV2Out(uniswapV2Out).estimateLiquidityValue(
                        assetToken,
                        assertsData[i].balance,
                        token
                    )
                {
                    amountInToken += IUniswapV2Out(uniswapV2Out)
                        .estimateLiquidityValue(
                            assetToken,
                            assertsData[i].balance,
                            token
                        );
                } catch Error(string memory reason) {
                    reason;
                }
            } else if (assertsData[i].assetType == IPool.AssetType.LEND) {
                amountInToken += IVenusLibrary(venusLibrary)
                    .calculateSuppliedValue(assetToken, pool);
            } else if (assertsData[i].assetType == IPool.AssetType.BORROW) {
                value = assertsData[i].balance > 0
                    ? getAmtInToken(
                        factory,
                        IVenusLibrary(venusLibrary).getUnderlyingAsset(
                            assetToken
                        ),
                        token,
                        assertsData[i].balance
                    )
                    : 0;
                amountInToken -= value;
                blockedAmount += value;
            } else {
                amountInToken += assertsData[i].balance > 0
                    ? getAmtInToken(
                        factory,
                        assetToken,
                        token,
                        assertsData[i].balance
                    )
                    : 0;
            }
            unchecked {
                ++i;
            }
        }

        address horizonLib = IFactory(factory).getHorizonProtocolLib();

        if (horizonLib != address(0)) {
            uint256 structuredProductsValue = IHorizonProtocolLib(
                IFactory(factory).getHorizonProtocolLib()
            ).getPortfolioValueInZusdDefaultList(pool);
            if (structuredProductsValue != 0) {
                value = getAmtInToken(
                    factory,
                    0xF0186490B18CB74619816CfC7FeB51cdbe4ae7b9, //zUSD
                    token,
                    structuredProductsValue
                );
                amountInToken += value;
                blockedAmount += value;
            }
        }

        IFuturesLib futuresLib = IFuturesLib(IFactory(factory).getFuturesLib());

        if (address(futuresLib) != address(0)) {
            (, , , , uint256 futuresLibValue) = futuresLib.getPositions(
                IPool(pool).getPlaceOrderResponses()
            );
            if (futuresLibValue != 0) {
                amountInToken += getAmtInToken(
                    factory,
                    0x55d398326f99059fF775485246999027B3197955,
                    token,
                    futuresLibValue
                );
            }
        }
    }

    function getAssetAmountsToToken(
        address factory,
        address pool,
        address token
    ) public view returns (uint256 amountInToken) {
        (amountInToken, ) = getAssetAndBlockedAmountsToToken(
            factory,
            pool,
            token
        );
    }

    function estimateLpAmount(
        address factory,
        address pool,
        address token,
        uint256 investAmount,
        bool externalCall
    ) external view returns (uint256) {
        uint256 poolAmountInUSDC = getAssetAmountsToToken(
            factory,
            pool,
            0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d // USDC
        );

        uint256 totalSupply = IPool(pool).totalSupply();
        uint256 investAmountInUSDC = getAmtInToken(
            factory,
            token,
            0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d, // USDC
            investAmount
        );

        if (totalSupply == 0) {
            return investAmountInUSDC;
        }

        return
            externalCall
                ? ((poolAmountInUSDC * (totalSupply + investAmountInUSDC)) /
                    poolAmountInUSDC) - totalSupply
                : ((poolAmountInUSDC * totalSupply) /
                    (poolAmountInUSDC - investAmountInUSDC)) - totalSupply;
    }

    function metadata(
        address factory,
        address pool,
        address manager
    ) external view returns (string memory) {
        string memory baseURI = IFactory(factory).getBaseUri();
        return
            bytes(baseURI).length != 0
                ? string(
                    abi.encodePacked(
                        baseURI,
                        Strings.toHexString(manager),
                        "/",
                        Strings.toHexString(pool),
                        ".json"
                    )
                )
                : "";
    }

    /// @dev Calculate the percentage of a fee

    function calculateFee(
        uint256 fee,
        uint256 value
    ) public pure returns (uint256) {
        if (fee == 0) return 0;
        return (value * fee) / 100000;
    }

    function calculateAvailableLpAmount(
        uint256 blockedAmount,
        uint256 allAmount,
        uint256 lpAmount
    ) public pure returns (uint256) {
        uint256 percent;
        if (blockedAmount * 100000 <= allAmount) percent = 0;
        else percent = (blockedAmount * 100000) / allAmount;
        return percent > 0 ? (lpAmount * percent) / 100000 : lpAmount;
    }

function getAssetAndBlockedAmountsToTokenPerAsset(
        address factory,
        address pool,
        address token
    ) external view returns(address[] memory asset, uint256[] memory amountInToken, uint256[] memory blockedAmount, uint8[] memory assetType){
        IPool.AssetBalances[] memory assertsData = IPool(pool)
            .assetsUnderManagement();
        asset = new address[](assertsData.length);
        assetType = new uint8[](assertsData.length);
        amountInToken = new uint256[](assertsData.length);
        blockedAmount = new uint256[](assertsData.length);

        (, address uniswapV2Out) = IFactory(factory).getUniAddresses();
        address venusLibrary = IFactory(factory).getVenusLibraryData();

        address assetToken;
        uint256 value;
        for (uint32 i; i < assertsData.length; ) {
            assetToken = assertsData[i].assetAddress;
            asset[i] = assetToken; 
            assetType[i] = uint8(assertsData[i].assetType);
            if (assertsData[i].assetType == IPool.AssetType.LPTOKEN) {
                try
                    IUniswapV2Out(uniswapV2Out).estimateLiquidityValue(
                        assetToken,
                        assertsData[i].balance,
                        token
                    )
                {
                    amountInToken[i] = IUniswapV2Out(uniswapV2Out)
                        .estimateLiquidityValue(
                            assetToken,
                            assertsData[i].balance,
                            token
                        );
                } catch Error(string memory reason) {
                    reason;
                }
            } else if (assertsData[i].assetType == IPool.AssetType.LEND) {
                amountInToken[i] = IVenusLibrary(venusLibrary)
                    .calculateSuppliedValue(assetToken, pool);
            } else if (assertsData[i].assetType == IPool.AssetType.BORROW) {
                value = assertsData[i].balance > 0
                    ? getAmtInToken(
                        factory,
                        IVenusLibrary(venusLibrary).getUnderlyingAsset(
                            assetToken
                        ),
                        token,
                        assertsData[i].balance
                    )
                    : 0;
                blockedAmount[i] = value;
            } else {
                amountInToken[i] = assertsData[i].balance > 0
                    ? getAmtInToken(
                        factory,
                        assetToken,
                        token,
                        assertsData[i].balance
                    )
                    : 0;
            }
            unchecked {
                ++i;
            }
        }
    }

    function getStructuredPeoductsToToken(
        address factory,
        address pool,
        address token
    ) external view returns(address[] memory underlyingAsset, uint256[] memory amountInToken){
        address horizonLib = IFactory(factory).getHorizonProtocolLib();

        if (horizonLib != address(0)) {
            (underlyingAsset, amountInToken) = IHorizonProtocolLib(
                IFactory(factory).getHorizonProtocolLib()
            ).getPortfolioDefaultProductsValueInZusdCustomList(pool);
            for (uint256 i; i < underlyingAsset.length; i++){
                amountInToken[i] = amountInToken[i] > 0 ? getAmtInToken(
                    factory,
                    0xF0186490B18CB74619816CfC7FeB51cdbe4ae7b9,//zUSD
                    token,
                    amountInToken[i]
                ) 
                : 0;
            }
        }

    }
    function getFuturesToToken(
        address factory,
        address pool,
        address token
    ) external view returns(address[] memory indexTokens, uint256[] memory amountInToken){

        IFuturesLib futuresLib = IFuturesLib(IFactory(factory).getFuturesLib());

        if (address(futuresLib) != address(0)) {
            bytes[] memory futuresData = IPool(pool).getPlaceOrderResponses();
            indexTokens = new address[](futuresData.length);
            amountInToken = new uint256[](futuresData.length);
            uint256[] memory totalValue = new uint256[](futuresData.length);
            ( , indexTokens, totalValue, ,) = futuresLib.getPositions(futuresData);
            uint256 positionsCount = indexTokens.length;
            if (positionsCount != 0) {
                for(uint256 i; i < positionsCount;){
                    amountInToken[i] = getAmtInToken(
                    factory,
                    0x55d398326f99059fF775485246999027B3197955,
                    token,
                    totalValue[i]
                );
                    unchecked {
                        ++i;
                    }
                }
               
            }
        }

    }
}
