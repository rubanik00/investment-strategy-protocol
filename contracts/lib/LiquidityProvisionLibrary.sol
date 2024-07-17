// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPoolLibrary.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IUniswapV2Out.sol";

contract LiquidityProvisionLibrary {
    address private constant USDT_ADDRESS =
        0x55d398326f99059fF775485246999027B3197955; // BSC USDT address;

    /// @dev enter
    /// @notice enter in Pancakeswap pair
    /// @param factory factory address
    /// @param pool pool address
    /// @param params params for enter
    function enter(
        address factory,
        address pool,
        IPool.EnterParams calldata params
    ) external payable{  
        IPool(pool).setSupportedLiquidityPairs(true, params.pairAddress, 0); 

        (address uniswapV2In, ) = IFactory(factory).getUniAddresses();
        uint256 ethValue;

        if (params.fromToken == address(0)) {
            ethValue = params.amount;
        } else {
            IERC20(params.fromToken).approve(uniswapV2In, params.amount); 
        }

        IFactory(factory).saveLiquidityToRouterAddress( 
            params.pairAddress,
            params.exchangeRouterAddress
        );
        
        uint256 lpAmount = 
        IUniswapV2In(uniswapV2In).enter{value: ethValue}(
            pool,
            params.fromToken,
            params.pairAddress,
            params.amount,
            params.minReceiveAmount,
            params.exchangeRouterAddress,
            params.swapOptions
        );

        uint256 usdAmount = IPoolLibrary(
            IFactory(factory).getPoolLibraryAddress()
        ).getAmtInToken(
                factory,
                params.fromToken,
                USDT_ADDRESS,
                params.amount
            );

        IFactory(factory).generatePoolEvent(
            "Enter",
            abi.encode(params.pairAddress, lpAmount, usdAmount)
        );
    }

    /// @dev exit
    /// @notice exit from Pancakeswap pair to chosen token
    /// @param factory factory address
    /// @param pool pool address
    /// @param toWhomToIssue toWhomToIssue address
    /// @param toToken convert to token
    /// @param pairAddress pair address
    /// @param lpAmount amount to exit
    /// @param minReceiveAmount min receive amount
    /// @param exchangeRouterAddress router address
    function exit(
        address factory,
        address pool, 
        address toWhomToIssue,
        address toToken,
        address pairAddress,
        uint256 lpAmount,
        uint256 minReceiveAmount,
        address exchangeRouterAddress
    ) external payable returns(uint256 tokenAmount) {
        if (!IPool(pool).isSupportedAsset(toToken)) revert IPool.NotSupportedToken();

        tokenAmount = exitWithoutEvent(
            factory,
            pool,
            toWhomToIssue,
            toToken,
            pairAddress,
            lpAmount,
            minReceiveAmount,
            exchangeRouterAddress
        );
        
        IFactory(factory).generatePoolEvent(
            "Exit",
            abi.encode(
                toToken,
                lpAmount,
                tokenAmount,
                IPoolLibrary(IFactory(factory).getPoolLibraryAddress()).getAmtInToken(
                    factory,
                    toToken,
                    USDT_ADDRESS,
                    tokenAmount
                )
            )
        );

        return tokenAmount;
    }

    function exitWithoutEvent(
        address factory,
        address pool, 
        address toWhomToIssue,
        address toToken,
        address pairAddress,
        uint256 lpAmount,
        uint256 minReceiveAmount,
        address exchangeRouterAddress
    ) public returns (uint256) {
        (, address uniswapV2Out) = IFactory(factory).getUniAddresses();
        IERC20(pairAddress).approve(uniswapV2Out, lpAmount);
        IPool(pool).setSupportedLiquidityPairs(false, pairAddress, lpAmount);

        return IUniswapV2Out(uniswapV2Out).exit(
            payable(toWhomToIssue),
            toToken,
            pairAddress,
            lpAmount,
            minReceiveAmount,
            exchangeRouterAddress
        );
    }

    function checkUnderlyingTokens(
        address pool,
        address pairAddress
    ) public view returns (bool) {
        if (
            !IPool(pool).isSupportedAsset(IUniswapV2Pair(pairAddress).token0()) ||
            !IPool(pool).isSupportedAsset(IUniswapV2Pair(pairAddress).token1())
            
        ) {
            return false;
        }
        return true;
    }
}