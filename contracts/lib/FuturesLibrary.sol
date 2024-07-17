// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {SignedInt, SignedIntOps} from "./helpers/SignedInt.sol";
import {SafeCast} from "./helpers/SafeCast.sol";
import "../interfaces/IOrderManager.sol";
import "../interfaces/IPool.sol";
import "../interfaces/ILevelPool.sol";
import "../interfaces/ILevelOracle.sol";
import "../lib/RevertReasonParser.sol";

library FuturesLibrary {
    using SafeCast for uint256;
    using SignedIntOps for int256;

    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address private constant ORDER_MANAGER =
        0xf584A17dF21Afd9de84F47842ECEAF6042b1Bb5b;
    address private constant LEVEL_ORACLE =
        0x04Db83667F5d59FF61fA6BbBD894824B233b3693;
    address private constant LEVEL_POOL =
        0xA5aBFB56a78D2BD4689b25B8A77fd49Bb0675874;

    /**
     * @notice  order creation and maintenance function
     * @dev     depending on the bytes, this function create an order,
     *          increases an order (deposit)
     *          or decreases an order (withdraw, close)
     * @param   pool  address of the pool
     * @param   updateType  INCREASE or DECREASE
     * @param   side  LONG or SHORT
     * @param   orderType  we only support MARKET
     * @param   indexToken  address of the index token
     * @param   collateralToken  address of the collateral token
     * @param   data  bytes field that contains:
     *                orderPrice,
     *                payToken,
     *                purchaseAmount,
     *                sizeChange,
     *                collateral,
     *                extradata
     * @param   amount  payable amount
     * @return position key raw (not wrapped into keccak256)
     */
    function placeMarketOrder(
        address pool,
        uint8 updateType,
        uint8 side,
        uint8 orderType,
        address indexToken,
        address collateralToken,
        bytes memory data,
        uint256 amount
    ) public returns (bytes memory) {
        require(
            IPool(pool).isSupportedAsset(indexToken) &&
                IPool(pool).isSupportedAsset(collateralToken),
            "FuturesLibrary: token is not supported."
        );
        address payToken;
        uint256 purchaseAmount;

        // check if increase
        if (updateType == 0) {
            (, payToken, purchaseAmount, , , ) = abi.decode(
                data,
                (uint256, address, uint256, uint256, uint256, bytes)
            );

            if (payToken != ETH) {
                IERC20(payToken).approve(ORDER_MANAGER, purchaseAmount);
            }
        }

        IOrderManager(ORDER_MANAGER).placeOrder{value: amount}(
            IOrderManager.UpdatePositionType(updateType),
            IOrderManager.Side(side),
            indexToken,
            collateralToken,
            IOrderManager.OrderType(orderType),
            data
        );

        return
            _getPositionKeyRaw(
                address(this),
                indexToken,
                collateralToken,
                side
            );
    }

    /**
     * @notice  cancels the order before it becomes a position
     * @param   orderId  id of the order that needs to be cancelled
     */
    function cancelMarketOrder(uint256 orderId) public {
        IOrderManager(ORDER_MANAGER).cancelOrder(orderId);
    }

    /**
     * @dev     function to get order ids and total amount of orders
     * @param   account  for which to receive order ids
     * @param   skip  number of orders to skip
     * @param   take  number of iterations
     * @return  orderIds  the array of the order ids
     * @return  total  total amount of orders
     */
    function getOrders(
        address account,
        uint256 skip,
        uint256 take
    ) public view returns (uint256[] memory orderIds, uint256 total) {
        return IOrderManager(ORDER_MANAGER).getOrders(account, skip, take);
    }

    /**
     * @notice  returns  the last oder id
     * @param   account  for which to receive order ids
     * @param   take  number of iterations
     * @return  uint256  last order id
     */
    function getLastOrder(
        address account,
        uint256 take
    ) public view returns (uint256) {
        (uint256[] memory orderIds, ) = getOrders(account, 0, take);

        return orderIds[orderIds.length - 1];
    }

    /**
     * @notice  retrieves a price for specific token from the LevelOracle
     * @param   token  for which to get the price
     * @return  uint256  the last price
     */
    function getLastPrice(address token) public view returns (uint256) {
        return ILevelOracle(LEVEL_ORACLE).getLastPrice(token);
    }

    /**
     * @notice  function to get the position info
     * @param   keyRaw a raw form of the key (returned from placeOrder())
     * @return  ILevelPool.Position  struct contains size, collateral value, reserveAmount, entryPrice, borrowIndex
     */
    function getPosition(
        bytes memory keyRaw
    ) public view returns (ILevelPool.Position memory) {
        bytes32 key = keccak256(keyRaw);
        return ILevelPool(LEVEL_POOL).positions(key);
    }

    /**
     * @notice  function to get information about a number of positions, as well as pnls and total value locked in Level
     * @param   keysRaw  an array of the raw form of the keys (returned from placeOrder())
     * @return  positions  array of structs, each contains size, collateral value, reserveAmount, entryPrice, borrowIndex
     * @return  indexTokens  array of index token 
     * @return  indexTokensValue  total value locked in each position
     * @return  pnls  profit and loss calculated
     * @return  totalValue  total value locked in protocol
     */
    function getPositions(
        bytes[] memory keysRaw
    )
        public
        view
        returns (
            ILevelPool.Position[] memory positions,
            address[] memory indexTokens,
            uint256[] memory indexTokensValue,
            int256[] memory pnls,
            uint256 totalValue
        )
    {
        positions = new ILevelPool.Position[](keysRaw.length);
        pnls = new int256[](keysRaw.length);
        indexTokens = new address[](keysRaw.length);
        indexTokensValue = new uint256[](keysRaw.length);

        for (uint256 i = 0; i < keysRaw.length; i++) {
            (, address indexToken, , uint8 side) = abi.decode(
                keysRaw[i],
                (address, address, address, uint8)
            );
            indexTokens[i] = indexToken;
            uint256 indexPrice = getLastPrice(indexToken);
            positions[i] = getPosition(keysRaw[i]);
            pnls[i] = _calcPnl(
                IOrderManager.Side(side),
                positions[i].size,
                positions[i].entryPrice,
                indexPrice
            );
            int256 sum = SafeCast.toInt256(positions[i].collateralValue) +
                pnls[i];
            if (sum < 0) sum = 0;
            totalValue += SafeCast.toUint256(sum);
            indexTokensValue[i] = SafeCast.toUint256(sum);
        }
    }

    /**
     * @notice  encodes the key that is used for getting a position info
     * @param   account  for which to encode a key
     * @param   indexToken  address of the index token
     * @param   collateralToken  address of the collateral token
     * @param   side  LONG or SHORT
     * @return  bytes  encoded bytes that later will be wrapped in keccak256
     */
    function _getPositionKeyRaw(
        address account,
        address indexToken,
        address collateralToken,
        uint8 side
    ) internal pure returns (bytes memory) {
        return
            abi.encode(
                account,
                indexToken,
                collateralToken,
                IOrderManager.Side(side)
            );
    }

    /**
     * @notice  Level's function that calculates profit and loss
     * @param   _side  LONG or SHORT
     * @param   _positionSize  from Position struct
     * @param   _entryPrice  from Position struct
     * @param   _indexPrice  can be obtained from getLastPrice()
     * @return  int256  profit and loss value
     */
    function _calcPnl(
        IOrderManager.Side _side,
        uint256 _positionSize,
        uint256 _entryPrice,
        uint256 _indexPrice
    ) internal pure returns (int256) {
        if (_positionSize == 0 || _entryPrice == 0) {
            return 0;
        }
        int256 entryPrice = _entryPrice.toInt256();
        int256 positionSize = _positionSize.toInt256();
        int256 indexPrice = _indexPrice.toInt256();
        if (_side == IOrderManager.Side.LONG) {
            return ((indexPrice - entryPrice) * positionSize) / entryPrice;
        } else {
            return ((entryPrice - indexPrice) * positionSize) / entryPrice;
        }
    }
}
