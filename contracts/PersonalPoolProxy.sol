// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./interfaces/IFactory.sol";

contract PersonalPoolProxy is BeaconProxy {
    IFactory.PoolType private constant poolType = IFactory.PoolType.PERSONAL_POOL;
    constructor() BeaconProxy(msg.sender, "") {}

    function implementation() external view returns (address) {
        return _implementation();
    }

    function _implementation() internal view override returns (address) {
        return IFactory(_getBeacon()).implementation(poolType);
    }
}
