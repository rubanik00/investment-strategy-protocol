// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IFactory.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPersonalPool.sol";
import "./interfaces/IPoolLibrary.sol";
import "./interfaces/ILendBorrowLibrary.sol";

import "./lib/RevertReasonParser.sol";

contract PersonalPoolLogic is Initializable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    EnumerableSet.AddressSet private supportedAssets; // addresses of supported tokens
    EnumerableSet.AddressSet private supportedPlatforms; // addresses of supported platforms
    EnumerableSet.AddressSet private supportedLiquidityPairs; // addresses of liquidity pairs
    EnumerableSet.Bytes32Set private uniqFutureData; // data for futures methods
    bytes[] public placeOrderResponses; // array of bytes with futures data

    struct PoolData {
        // bool published; // if true - all users can see this pool; if false - only manager can see this pool;
        bool isClose; // marking that the pull is closed for use forever;
        bool directCallAllowed; // marking that poolManager can use external calls for assets;
        address manager; // address of pool owner
        IFactory factory; // address of factory
    }

    PoolData public poolData; // pool storage data

    address public constant USDT_ADDRESS =
        0x55d398326f99059fF775485246999027B3197955; // BSC USDT address;

    mapping(address => uint32) public investorLockPeriod; // share tokens frozen period for the investor;
    mapping(address => IPool.Analytics) public analytics; // analytic data;

    /**
     * @dev Throws if called by any account other than the Manager.
     */
    modifier onlyManager() {
        if (msg.sender != poolData.manager)
            revert IPersonalPool.CallerIsNotManager();
        _;
    }

    /**
     * @dev Returns revert if pool not open
     */
    modifier onlyOpenPool() {
        if (poolData.isClose) {
            revert IPersonalPool.PooIsClose();
        }
        _;
    }

    receive() external payable {}

    // fallback() external payable {}

    constructor() {
        _disableInitializers();
    }

    /**
    @notice Pool initialization function with initial parameters
    @param poolParams pool details struct, that contains:
    personal pool address.
    personal pool owner (manager).
    list of assets that will be supported.
    list of platforms that will be supported.
    */
    function initialize(
        IPersonalPool.PersonalPoolParams calldata poolParams
    ) external initializer {
        poolData.factory = IFactory(msg.sender);
        poolData.manager = poolParams.manager;

        for (uint256 i = 0; i < poolParams.supportedAssets.length; ) {
            supportedAssets.add(poolParams.supportedAssets[i]);
            unchecked {
                ++i;
            }
        }

        for (uint256 i = 0; i < poolParams.supportedPlatforms.length; ) {
            supportedPlatforms.add(poolParams.supportedPlatforms[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @dev invest
    /// @notice allows user invest funds to pool
    /// @notice receive an LP token in return
    /// @param token address of invested asset
    /// @param investAmount invested amount

    function invest(
        address token,
        uint256 investAmount
    ) external payable onlyOpenPool onlyManager {
        if (!supportedAssets.contains(token))
            revert IPersonalPool.NotSupportedToken();
        PoolData memory pool = poolData;

        IPoolLibrary poolLibrary = IPoolLibrary(
            pool.factory.getPoolLibraryAddress()
        );

        if (token != address(0))
            IERC20(token).safeTransferFrom(
                msg.sender,
                address(this),
                investAmount
            );
        else {
            require(investAmount == msg.value, "msg.value != investAmount");
        }

        uint256 investInUSDT = poolLibrary.getAmtInToken(
            address(pool.factory),
            token,
            USDT_ADDRESS,
            investAmount
        );

        analytics[address(0)].investedInUSD += investInUSDT;
        analytics[msg.sender].investedInUSD += investInUSDT;

        IFactory(pool.factory).generatePoolEvent(
            "Invested",
            abi.encode(token, investInUSDT, investAmount)
        );
    }

    /// @dev withdraw
    /// @notice allows user withdraw funds from pool
    /// @notice receive an Underlying token in return
    ///  lpAmount amount of LP tokens
    ///  convertToTokenAddress convert token address
    ///  minAmount min amount for withdraw

    function withdraw(
        address token,
        uint256 withdrawAmount
    ) external payable nonReentrant onlyManager {
        IPersonalPool.WithdrawInternalParams memory internalParams;

        if (!supportedAssets.contains(token))
            revert IPersonalPool.NotSupportedToken();

        if (
            (token == address(0) && address(this).balance < withdrawAmount) ||
            (token != address(0) &&
                IERC20(token).balanceOf(address(this)) < withdrawAmount)
        ) {
            revert IPersonalPool.InsufficientFunds();
        }

        (
            internalParams.storageContract,
            ,
            internalParams.convertLibrary
        ) = poolData.factory.getDexLibraryData();
        (internalParams.treasuryAddress, internalParams.systemFee) = poolData
            .factory
            .getTreasuryAddressAndFee();

        uint256 feeValue = (internalParams.systemFee * withdrawAmount) / 1000000;
        uint256 withdrawAmountNet = withdrawAmount - feeValue;

        _send(token, internalParams.treasuryAddress, feeValue);
        _send(token, msg.sender, withdrawAmountNet);

        internalParams.withdrawnInUSD = IPoolLibrary(
            poolData.factory.getPoolLibraryAddress()
        ).getAmtInToken(
                address(poolData.factory),
                token,
                USDT_ADDRESS,
                withdrawAmountNet
            );
        analytics[address(0)].withdrawnInUSD += internalParams.withdrawnInUSD;
        analytics[msg.sender].withdrawnInUSD += internalParams.withdrawnInUSD;
        
        IFactory(poolData.factory).generatePoolEvent(
            "Withdrawn",
            abi.encode(
                withdrawAmountNet,
                token,
                feeValue,
                internalParams.withdrawnInUSD
            )
        );
    }

    function _send(address asset, address to, uint256 amount) private {
        if (amount > 0) {
            if (asset == address(0)) {
                (bool sent, ) = to.call{value: amount}("");
                require(sent, "Failed to send Ether");
            } else {
                IERC20(asset).safeTransfer(to, amount);
            }
        }
    }

    /// @dev directCallStrategy
    /// @notice only Manager & if this option is enabled
    /// @notice call a contract with the specified data
    /// @param calls struct with contract address and call data

    function directCallStrategy(
        IPool.Call[] calldata calls
    )
        external
        onlyManager
        returns (uint256 blockNumber, bytes[] memory returnData)
    {
        require(poolData.directCallAllowed, "direct call is not allowed");
        blockNumber = block.number;
        returnData = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ) {
            // require(factory.isPlatformSupported(calls[i].target), "Platform not supported");
            (bool status, bytes memory result) = calls[i].target.call(
                calls[i].callData
            );
            require(
                status,
                RevertReasonParser.parse(result, "directCallStrategy: ")
            );

            returnData[i] = result;
            unchecked {
                ++i;
            }
        }
    }

    /// @dev libraryCall
    /// @notice only Manager & Library address is contains
    /// @notice call library contract with data by delegatecall
    /// @param lib library address
    /// @param data call data

    function libraryCall(
        address lib,
        bytes calldata data
    ) external onlyManager {
        IFactory factory = IFactory(poolData.factory);
        require(
            supportedPlatforms.contains(lib) && factory.isLibrarySupported(lib),
            "Library not supported"
        );

        (bool status, bytes memory result) = lib.delegatecall(data);
        require(status, RevertReasonParser.parse(result, "libraryCall: "));

        if (lib == factory.getFuturesLib()) {
            if (
                keccak256(
                    abi.encodeWithSignature(
                        "placeMarketOrder(address,uint8,uint8,uint8,address,address,bytes,uint256)"
                    )
                ) == keccak256(bytes(data[0:4]))
            ) {
                bytes32 key = keccak256(result);
                if (!uniqFutureData.contains(key)) {
                    uniqFutureData.add(key);
                    placeOrderResponses.push(abi.decode(result, (bytes)));
                }
            }
            factory.generatePoolEvent("Futures", data);
        }
    }

    /// @dev enter
    /// @notice only Manager & Platform address is contains
    /// @notice enter in Pancakeswap pair
    /// @param params params for enter

    function enter(
        IPersonalPool.EnterParams calldata params
    ) external payable onlyManager {
        supportedLiquidityPairs.add(params.pairAddress);
        (address uniswapV2In, ) = poolData.factory.getUniAddresses();
        uint256 ethValue;

        require(
            supportedPlatforms.contains(uniswapV2In),
            "Platform not supported"
        );

        if (params.fromToken == address(0)) {
            ethValue = params.amount;
        } else {
            IERC20(params.fromToken).approve(uniswapV2In, params.amount);
        }

        poolData.factory.saveLiquidityToRouterAddress(
            params.pairAddress,
            params.exchangeRouterAddress
        );

        uint256 lpAmount = IUniswapV2In(uniswapV2In).enter{value: ethValue}(
            address(this),
            params.fromToken,
            params.pairAddress,
            params.amount,
            params.minReceiveAmount,
            params.exchangeRouterAddress,
            params.swapOptions
        );

        uint256 usdAmount = IPoolLibrary(
            poolData.factory.getPoolLibraryAddress()
        ).getAmtInToken(
                address(poolData.factory),
                params.fromToken,
                USDT_ADDRESS,
                params.amount
            );

        IFactory(poolData.factory).generatePoolEvent(
            "Enter",
            abi.encode(params.pairAddress, lpAmount, usdAmount)
        );
    }

    /// @dev exit
    /// @notice only Manager & Platform address is contains
    /// @notice exit from Pancakeswap pair to chosen token
    /// @param toToken convert to token
    /// @param pairAddress pair address
    /// @param lpAmount amount to exit
    /// @param minReceiveAmount min receive amount
    /// @param exchangeRouterAddress router address

    function exit(
        address toToken,
        address pairAddress,
        uint256 lpAmount,
        uint256 minReceiveAmount,
        address exchangeRouterAddress
    ) external payable onlyManager {
        IFactory factory = poolData.factory;
        uint256 tokenAmount = _exit(
            address(this),
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
                IPoolLibrary(factory.getPoolLibraryAddress()).getAmtInToken(
                    address(factory),
                    toToken,
                    USDT_ADDRESS,
                    tokenAmount
                )
            )
        );
    }

    function _exit(
        address toWhomToIssue,
        address toToken,
        address pairAddress,
        uint256 lpAmount,
        uint256 minReceiveAmount,
        address exchangeRouterAddress
    ) private returns (uint256) {
        (, address uniswapV2Out) = poolData.factory.getUniAddresses();
        if (IERC20(pairAddress).balanceOf(address(this)) - lpAmount == 0)
            supportedLiquidityPairs.remove(pairAddress);

        IERC20(pairAddress).approve(uniswapV2Out, lpAmount);

        uint256 tokenAmount = IUniswapV2Out(uniswapV2Out).exit(
            payable(toWhomToIssue),
            toToken,
            pairAddress,
            lpAmount,
            minReceiveAmount,
            exchangeRouterAddress
        );
        return tokenAmount;
    }

    /**
    @notice set direct call allowance
    @param action true or false
    */

    function setDirectCallAllowance(bool action) external onlyManager {
        poolData.directCallAllowed = action;
    }

    /**
    @notice close pool for use
    */

    function closePool() external onlyOpenPool onlyManager {
        poolData.isClose = true;
    }

    /// View methods

    /**
    @notice checkUnderlyingTokens - check pairs for pancakeswap
    */

    function checkUnderlyingTokens(
        address pairAddress
    ) external view returns (bool) {
        if (
            !supportedAssets.contains(IUniswapV2Pair(pairAddress).token0()) ||
            !supportedAssets.contains(IUniswapV2Pair(pairAddress).token1())
        ) {
            return false;
        }
        return true;
    }

    /**
    @notice getFactoryAddress
    */

    function getFactoryAddress() external view returns (address) {
        return address(poolData.factory);
    }

    function getSupportLiquidityPairs()
        external
        view
        returns (address[] memory)
    {
        return supportedLiquidityPairs.values();
    }

    /**
    @notice The function of calculating all the assets of this pool
    @return struct of (address of asset; balance of pool address)
    */
    function assetsUnderManagement()
        public
        view
        returns (IPool.AssetBalances[] memory)
    {
        address venusLibrary = poolData.factory.getVenusLibraryData();

        address[] memory supportedLendsBorrows;
        if (venusLibrary != address(0)) {
            address[] memory lendsBorrowsArray = IVenusLibrary(venusLibrary)
                .getEnteredAssets(address(this));
            supportedLendsBorrows = lendsBorrowsArray;
        }

        IPool.AssetBalances[] memory assetsBalances = new IPool.AssetBalances[](
            supportedAssets.length() +
                supportedLiquidityPairs.length() +
                (supportedLendsBorrows.length * 2)
        );
        address token;
        uint16 j = 0;

        for (uint16 i; i < supportedLiquidityPairs.length(); ) {
            token = supportedLiquidityPairs.at(i);
            assetsBalances[j] = IPool.AssetBalances(
                token,
                IERC20(token).balanceOf(address(this)),
                IPool.AssetType.LPTOKEN
            );
            unchecked {
                ++j;
                ++i;
            }
        }

        for (uint16 i; i < supportedAssets.length(); ) {
            token = supportedAssets.at(i);
            assetsBalances[j] = IPool.AssetBalances(
                token,
                token != address(0)
                    ? IERC20(token).balanceOf(address(this))
                    : address(this).balance,
                IPool.AssetType.ERC20
            );
            unchecked {
                ++j;
                ++i;
            }
        }

        for (uint16 i; i < supportedLendsBorrows.length; ) {
            assetsBalances[j] = IPool.AssetBalances(
                supportedLendsBorrows[i],
                IERC20(supportedLendsBorrows[i]).balanceOf(address(this)),
                IPool.AssetType.LEND
            );
            assetsBalances[j + 1] = IPool.AssetBalances(
                supportedLendsBorrows[i],
                IVenusLibrary(venusLibrary).getBorrowBalanceStored(
                    supportedLendsBorrows[i],
                    address(this)
                ),
                IPool.AssetType.BORROW
            );
            unchecked {
                j += 2;
                ++i;
            }
        }

        return assetsBalances;
    }

    /**
    @return complete information about the this pool
    */
    function poolInfo()
        external
        view
        returns (IPersonalPool.PersonalPoolDetails memory)
    {
        PoolData memory pool = poolData;

        return
            IPersonalPool.PersonalPoolDetails(
                address(this),
                pool.manager,
                pool.isClose,
                0,
                assetsUnderManagement()
            );
    }

    function getSupportedAssetsAndPlatforms()
        external
        view
        returns (address[] memory, address[] memory)
    {
        return (supportedAssets.values(), supportedPlatforms.values());
    }

    function getPlaceOrderResponses() external view returns (bytes[] memory) {
        return placeOrderResponses;
    }

    function isSupportedAsset(address asset) external view returns (bool) {
        return supportedAssets.contains(asset);
    }
}
