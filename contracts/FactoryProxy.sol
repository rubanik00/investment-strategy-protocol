// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract FactoryProxy is ERC1967Proxy, Ownable {
    constructor(address _logic, bytes memory _data)
        ERC1967Proxy(_logic, _data)
    {}

    function upgradeToAndCall(address _newLogic, bytes memory _data)
        external
        onlyOwner
    {
        _upgradeToAndCall(_newLogic, _data, false);
    }
}
