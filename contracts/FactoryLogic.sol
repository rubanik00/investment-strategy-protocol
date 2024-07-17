// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPersonalPool.sol";
import "./interfaces/IFactory.sol";
import "./PoolProxy.sol";
import "./PersonalPoolProxy.sol";

contract FactoryLogic is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private poolAddresses; // addresses of all created pools
    EnumerableSet.AddressSet private personalPoolAddresses; // addresses of all personal trading accounts
    EnumerableSet.AddressSet private whitelistedAssets; // addresses of whitelisted tokens
    EnumerableSet.AddressSet private whitelistedPlatforms; // addresses of whitelisted platforms
    EnumerableSet.AddressSet private whitelistedLibraries; // addresses of whitelisted libraries

    mapping(address => address) private lpAddressToRouter; // lp addresses to router addresses
    mapping(address => address[]) private userPersonalPools; // addresses of personal trading accounts of the user

    address public personalPoolLogic; // personal pool logic contract
    address public poolLogic; // pool logic contract
    address public poolLibrary; // pool library contract
    address public liquidityProvisionLibrary; // path Out address
    address public lendBorrowLibrary; // lendBorrow venus library contract
    address public futuresLibrary; // futures library contract
    address public treasuryFund; // fee collector address
    address public networkNativeToken; // address of native network wrapped token (for ex. WBNB/WETH)
    address public storageContract; // Dex Library storage contract address
    address public dexConvert; // address Dex Library convert contract address
    address public dexEstimate; // address Dex Library estimate contract address
    address public horizonProtocolLib; // Horizon Protocol contract address
    address public venusContract; // Venus Library contract
    address public uniswapV2In; // path In address
    address public uniswapV2Out; // path Out address
    string public baseUri; // metadata baseURI
    uint24 public systemFee; // platform fee

    IFactory.PoolType private poolType;

    error CallerIsNotAPool();
    error TokenIsNotInTheWhitelist();
    error PlatformIsNotInTheWhitelist();
    error AddressIsZero();
    error EmptyLogic();

    event NewPool(address pool);
    event NewPersonalPool(address personalPool, address creator);
    event PoolContractEvent(
        address sender,
        address poolContract,
        string eventName,
        bytes eventParams
    );

    /// @dev Throws if called by any account other than the Manager.

    modifier onlyPool() {
        if (
            !(poolAddresses.contains(msg.sender) ||
                personalPoolAddresses.contains(msg.sender))
        ) revert CallerIsNotAPool();

        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor

    constructor() {
        _disableInitializers();
    }

    /// @notice Factory initialization function with initial parameters

    function initialize(
        IFactory.InitialParams memory params
    ) external initializer {
        __Ownable_init_unchained();

        poolLogic = params.poolLogic;
        personalPoolLogic = params.personalPoolLogic;
        networkNativeToken = params.networkNativeToken;
        treasuryFund = params.treasuryFund;
        baseUri = params.baseUri;
        systemFee = params.fee;
        uniswapV2In = params.uniswapV2In;
        uniswapV2Out = params.uniswapV2Out;
        poolLibrary = params.poolLibrary;
        liquidityProvisionLibrary = params.liquidityProvisionLibrary;
        lendBorrowLibrary = params.lendBorrowLibrary;
        storageContract = params.storageContract;
        dexConvert = params.dexConvert;
        dexEstimate = params.dexEstimate;
        venusContract = params.venusContract;
        horizonProtocolLib = params.horizonProtocolLib;
        futuresLibrary = params.futuresLibrary;

        uint16 i;
        for (; i < params.whitelistedAssets.length; ) {
            whitelistedAssets.add(params.whitelistedAssets[i]);
            unchecked {
                ++i;
            }
        }

        for (i = 0; i < params.whitelistedPlatforms.length; ) {
            whitelistedPlatforms.add(params.whitelistedPlatforms[i]);
            unchecked {
                ++i;
            }
        }

        whitelistedLibraries.add(params.poolLibrary);
        whitelistedLibraries.add(params.dexConvert);
        whitelistedLibraries.add(params.dexEstimate);
        whitelistedLibraries.add(params.venusContract);
        whitelistedLibraries.add(params.lendBorrowLibrary);
        whitelistedLibraries.add(params.futuresLibrary);
        whitelistedLibraries.add(params.liquidityProvisionLibrary);        
    }

    /// @dev createPool
    /// @notice function for creating a new Pool contract with specified parameters
    /// @param _poolParams - structure with pool params

    function createPool(
        IFactory.Pool memory _poolParams
    ) external nonReentrant {
        poolType = IFactory.PoolType.POOL;
        address pool = payable(new PoolProxy());
        if (pool == address(0)) revert AddressIsZero();

        checkAssetsAndPlatform(
            _poolParams.supportedAssets,
            _poolParams.supportedPlatforms
        );

        IPool(pool).initialize(
            IPool.PoolParams(
                _poolParams.feePercentage,
                _poolParams.lockPeriodInSec,
                _poolParams.frequency,
                _poolParams.privacyStatus,
                _poolParams.published,
                _poolParams.name,
                _poolParams.symbol,
                _poolParams.feeCollector,
                msg.sender, // managerAddress,
                _poolParams.supportedAssets,
                _poolParams.supportedPlatforms,
                _poolParams.whitelistedUsers,
                _poolParams.redemptionSupportedAssets,
                _poolParams.risk,
                _poolParams.minInvestmentAmount,
                _poolParams.maxInvestmentAmount,
                _poolParams.entryFee,
                _poolParams.exitFee,
                _poolParams.autoSwap
            )
        );

        poolAddresses.add(pool);
        emit NewPool(pool);
    }

    /// @dev createPersonalPool
    /// @notice function for creating a new Personal Pool (Personal Trading Account) contract with specified parameters
    /// @param _personalPoolParams - structure with pool params

    function createPersonalPool(
        IFactory.PersonalPool memory _personalPoolParams
    ) external nonReentrant {
        poolType = IFactory.PoolType.PERSONAL_POOL;
        address pool = payable(new PersonalPoolProxy());
        if (pool == address(0)) revert AddressIsZero();

        checkAssetsAndPlatform(
            _personalPoolParams.supportedAssets,
            _personalPoolParams.supportedPlatforms
        );

        IPersonalPool(pool).initialize(
            IPersonalPool.PersonalPoolParams(
                msg.sender, // managerAddress,
                _personalPoolParams.supportedAssets,
                _personalPoolParams.supportedPlatforms
            )
        );

        personalPoolAddresses.add(pool);
        userPersonalPools[msg.sender].push(pool);
        emit NewPersonalPool(pool, msg.sender);
    }

    // Admin methods

    /// @dev saveLiquidityToRouterAddress
    /// @param lpAddress - address of Pancake Lp pair token
    /// @param routerAddress - Pancake router address

    function saveLiquidityToRouterAddress(
        address lpAddress,
        address routerAddress
    ) external onlyPool {
        lpAddressToRouter[lpAddress] = routerAddress;
    }

    /// @dev generatePoolEvent
    /// @notice Function for control events from all created pools.
    /// @notice Function accepts data from a specific pool and creates an event.
    /// @notice It helps to handle only one contract instead of all the pools.
    /// @param eventName - specific event title
    /// @param eventParams - params paced event in bytes

    function generatePoolEvent(
        string calldata eventName,
        bytes calldata eventParams
    ) external onlyPool {
        // tx.origin - in this case who sent the tx, manager or user
        // msg.sender - in this case pool's address
        // eventName - event name
        // eventName - bytes of the event params
        emit PoolContractEvent(tx.origin, msg.sender, eventName, eventParams);
    }

    /// @dev setPoolLogic
    /// @notice allows set different pool logic to use.
    /// @notice for old and new users (cause we use upgradeableBeacon)
    /// @param _poolLogic address of pool logic

    function setPoolLogic(address _poolLogic) external onlyOwner {
        if (_poolLogic == address(0)) revert EmptyLogic();
        poolLogic = _poolLogic;
    }

    /// @dev setPersonalPoolLogic
    /// @notice allows set different pool logic to use.
    /// @notice for old and new users (cause we use upgradeableBeacon)
    /// @param _personalPoolLogic address of pool logic

    function setPersonalPoolLogic(
        address _personalPoolLogic
    ) external onlyOwner {
        if (_personalPoolLogic == address(0)) revert EmptyLogic();
        personalPoolLogic = _personalPoolLogic;
    }

    /// @dev setDexLibs
    /// @notice set new library for exchange tokens
    /// @param _storageContract address of storage contract (contract for library)
    /// @param _dexChange address of dex library
    /// @param _dexEstimate address of estimate library

    function setDexLibs(
        address _storageContract,
        address _dexChange,
        address _dexEstimate
    ) external onlyOwner {
        if (!whitelistedLibraries.contains(_dexChange)) {
            whitelistedLibraries.remove(dexConvert);
            whitelistedLibraries.add(_dexChange);
        }
        if (!whitelistedLibraries.contains(_dexEstimate)) {
            whitelistedLibraries.remove(dexEstimate);
            whitelistedLibraries.add(_dexEstimate);
        }

        if (!whitelistedPlatforms.contains(_dexChange)) {
            whitelistedPlatforms.remove(dexEstimate);
            whitelistedPlatforms.add(_dexEstimate);
        }
        if (!whitelistedPlatforms.contains(_dexEstimate)) {
            whitelistedPlatforms.remove(dexEstimate);
            whitelistedPlatforms.add(_dexEstimate);
        }

        storageContract = _storageContract;
        dexConvert = _dexChange;
        dexEstimate = _dexEstimate;
    }

    /// @dev setVenusLibs
    /// @notice set new library for venus
    /// @param _venusContract address of venus library

    function setVenusLibs(address _venusContract) external onlyOwner {
        if (!whitelistedLibraries.contains(_venusContract)) {
            whitelistedLibraries.remove(venusContract);
            whitelistedLibraries.add(_venusContract);
        }
        if (!whitelistedPlatforms.contains(_venusContract)) {
            whitelistedPlatforms.remove(venusContract);
            whitelistedPlatforms.add(_venusContract);
        }

        venusContract = _venusContract;
    }

    /// @dev setUniAddresses
    /// @notice set new uni addresses
    /// @param _uniswapV2In address of uniIn
    /// @param _uniswapV2Out address of uniOut

    function setUniAddresses(
        address _uniswapV2In,
        address _uniswapV2Out
    ) external onlyOwner {
        if (!whitelistedPlatforms.contains(uniswapV2In)) {
            whitelistedPlatforms.remove(uniswapV2In);
            whitelistedPlatforms.add(_uniswapV2In);
        }
        uniswapV2In = _uniswapV2In;
        uniswapV2Out = _uniswapV2Out;
    }

    /**
    @notice add new assets to whitelistedLibraries
    @param libraries array of libraries
    */
    function manageLibrariesToWhitelist(
        address[] memory libraries,
        bool action
    ) external onlyOwner {
        if (action) {
            for (uint16 i = 0; i < libraries.length; ) {
                whitelistedLibraries.add(libraries[i]);
                unchecked {
                    ++i;
                }
            }
        } else {
            for (uint16 i = 0; i < libraries.length; ) {
                whitelistedLibraries.remove(libraries[i]);
                unchecked {
                    ++i;
                }
            }
        }
    }

    /**
    @notice add new assets to whitelistedAssets
    @param assets array of assets
    */
    function manageAssetsToWhitelist(
        address[] memory assets,
        bool action
    ) external onlyOwner {
        if (action) {
            for (uint16 i = 0; i < assets.length; ) {
                whitelistedAssets.add(assets[i]);
                unchecked {
                    ++i;
                }
            }
        } else {
            for (uint16 i = 0; i < assets.length; ) {
                whitelistedAssets.remove(assets[i]);
                unchecked {
                    ++i;
                }
            }
        }
    }

    /**
    @notice add new platforms to whitelistedAssets
    @param platforms array of platforms
    */
    function managePlatformsToWhitelist(
        address[] memory platforms,
        bool action
    ) external onlyOwner {
        if (action) {
            for (uint16 i = 0; i < platforms.length; ) {
                whitelistedPlatforms.add(platforms[i]);
                unchecked {
                    ++i;
                }
            }
        } else {
            for (uint16 i = 0; i < platforms.length; ) {
                whitelistedPlatforms.remove(platforms[i]);
                unchecked {
                    ++i;
                }
            }
        }
    }

    /// @dev setBaseUri
    /// @notice set new base uri
    /// @param newBaseUri new base uri

    function setBaseUri(string memory newBaseUri) external onlyOwner {
        baseUri = newBaseUri;
    }

    /// @dev setTreasuryFundAndFee set new collector and fee percentage
    /// @notice newTreasuryFund new collector address
    /// @param newFee new fee percentage

    function setTreasuryFundAndFee(
        address newTreasuryFund,
        uint24 newFee
    ) external onlyOwner {
        treasuryFund = newTreasuryFund;
        systemFee = newFee;
    }

    /// @dev setPoolLibrary set new pool library
    /// @notice newPoolLib new pool library address

    function setPoolLibrary(address newPoolLib) external onlyOwner {
        if (!whitelistedPlatforms.contains(newPoolLib)) {
            whitelistedPlatforms.remove(poolLibrary);
            whitelistedPlatforms.add(newPoolLib);
        }
        poolLibrary = newPoolLib;
    }

    /// @dev setLiquidityProvisionLibrary set new liquidityProvisionLibrary
    /// @notice liquidityProvisionLibrary_ new liquidityProvisionLibrary address

    function setLiquidityProvisionLibrary(address liquidityProvisionLibrary_) external onlyOwner {
        if (!whitelistedPlatforms.contains(liquidityProvisionLibrary_)) {
            whitelistedPlatforms.remove(liquidityProvisionLibrary);
            whitelistedPlatforms.add(liquidityProvisionLibrary_);
        }
        liquidityProvisionLibrary = liquidityProvisionLibrary_;
    }

    /// @dev setHorizonProtocolLib set new HorizonProtocol library
    /// @notice newLib new HorizonProtocol library address

    function setHorizonProtocolLib(address newLib) external onlyOwner {
        if (!whitelistedLibraries.contains(newLib)) {
            whitelistedLibraries.remove(horizonProtocolLib);
            whitelistedLibraries.add(newLib);
        }
        if (!whitelistedPlatforms.contains(newLib)) {
            whitelistedPlatforms.remove(horizonProtocolLib);
            whitelistedPlatforms.add(newLib);
        }
        horizonProtocolLib = newLib;
    }

    /// @dev setLendBorrowLib set new LendBorrow library
    /// @notice newLib new LendBorrow library address

    function setLendBorrowLib(address newLib) external onlyOwner {
        if (!whitelistedLibraries.contains(newLib)) {
            whitelistedLibraries.remove(lendBorrowLibrary);
            whitelistedLibraries.add(newLib);
        }
        if (!whitelistedPlatforms.contains(newLib)) {
            whitelistedPlatforms.remove(lendBorrowLibrary);
            whitelistedPlatforms.add(newLib);
        }
        lendBorrowLibrary = newLib;
    }

    /// @dev setFuturesLib set new Futures library
    /// @notice newLib new Futures library address

    function setFuturesLib(address newLib) external onlyOwner {
        if (!whitelistedLibraries.contains(newLib)) {
            whitelistedLibraries.remove(futuresLibrary);
            whitelistedLibraries.add(newLib);
        }
        if (!whitelistedPlatforms.contains(newLib)) {
            whitelistedPlatforms.remove(futuresLibrary);
            whitelistedPlatforms.add(newLib);
        }
        futuresLibrary = newLib;
    }

    // View methods

    /// @dev getRouterAddress get router address
    /// @notice lpAddress lp address (key)

    function getRouterAddress(
        address lpAddress
    ) external view returns (address) {
        return lpAddressToRouter[lpAddress];
    }

    /**
    @notice Getting all created pools with their information
    */
    function getPools(
        uint256 offset,
        uint256 limit
    ) external view returns (IPool.PoolDetails[] memory) {
        IPool.PoolDetails[] memory pools = new IPool.PoolDetails[](limit);
        IPool.PoolDetails memory result;
        uint256 j = 0;
        for (uint256 i = offset; i < offset + limit; ) {
            result = IPool(poolAddresses.at(i)).poolInfo();
            if (
                result.published ||
                (!result.published && msg.sender == result.manager)
            ) {
                pools[j] = result;
            }
            unchecked {
                ++i;
                ++j;
            }
        }
        return pools;
    }

    /**
    @notice Getting all created pool addresses
    */
    function getPoolAddresses() external view returns (address[] memory) {
        return poolAddresses.values();
    }

    /**
    @notice Getting all created personal pool addresses
    */
    function getPersonalPoolAddresses()
        external
        view
        returns (address[] memory)
    {
        return personalPoolAddresses.values();
    }

    /**
    @notice Getting all created personal pool addresses of the user
    @param user address of the user
    */
    function getUserPersonalPoolAddresses(address user)
        external
        view
        returns (address[] memory)
    {
        return userPersonalPools[user];
    }

    /// @dev getWhitelistedAssets get all supported assets

    function getWhitelistedAssets() external view returns (address[] memory) {
        return whitelistedAssets.values();
    }

    /// @dev getWhitelistedAssets get all supported platforms

    function getWhitelistedPlatforms()
        external
        view
        returns (address[] memory)
    {
        return whitelistedPlatforms.values();
    }

    /**
    @notice Checking received assets and platforms for whitelisting
    @param assets array of assets
    @param platforms array of platforms
    */
    function checkAssetsAndPlatform(
        address[] memory assets,
        address[] memory platforms
    ) private view {
        uint16 i;
        for (i = 0; i < assets.length; ) {
            if (!whitelistedAssets.contains(assets[i]))
                revert TokenIsNotInTheWhitelist();
            unchecked {
                ++i;
            }
        }

        for (i = 0; i < platforms.length; ) {
            if (!whitelistedPlatforms.contains(platforms[i]))
                revert PlatformIsNotInTheWhitelist();
            unchecked {
                ++i;
            }
        }
    }

    // @dev getDexLibraryData get dex library contract

    function getDexLibraryData()
        external
        view
        returns (
            address storageLibContract,
            address estimateContract,
            address convertContract
        )
    {
        return (storageContract, dexEstimate, dexConvert);
    }

    // @dev getVenusLibraryData get Venus library contract

    function getVenusLibraryData() external view returns (address) {
        return venusContract;
    }

    // @dev getUniAddresses get Uni addresses

    function getUniAddresses() external view returns (address, address) {
        return (uniswapV2In, uniswapV2Out);
    }

    // @dev getHorizonProtocolLib get HorizonProtocol library contract

    function getHorizonProtocolLib() external view returns (address) {
        return horizonProtocolLib;
    }

    // @dev getFuturesLib get Futures library contract

    function getFuturesLib() external view returns (address) {
        return futuresLibrary;
    }

    // @dev getLiquidityProvisionLib get liquidityProvisionLibrary library contract

    function getLiquidityProvisionLib() external view returns (address) {
        return liquidityProvisionLibrary;
    }

    // @dev getPoolLibraryAddress get PoolLibrary library contract

    function getPoolLibraryAddress() external view returns (address) {
        return poolLibrary;
    }

    // @dev getLendBorrowLibraryAddress get LendBorrow library contract

    function getLendBorrowLibraryAddress() external view returns (address) {
        return lendBorrowLibrary;
    }

    // @dev isLibrarySupported returns true or false if contains lib in whitelistedLibraries

    function isLibrarySupported(address lib) external view returns (bool) {
        return whitelistedLibraries.contains(lib);
    }

    // @dev isPlatformSupported returns true or false if contains platform in whitelistedPlatforms

    function isPlatformSupported(
        address platform
    ) external view returns (bool) {
        return whitelistedPlatforms.contains(platform);
    }

    // @dev getBaseUri get base uri

    function getBaseUri() external view returns (string memory) {
        return baseUri;
    }

    // @dev getTreasuryAddressAndFee get treasury address and fee percentage

    function getTreasuryAddressAndFee()
        external
        view
        returns (address, uint24)
    {
        return (treasuryFund, systemFee);
    }

    /**
    @notice function to get pool logic implementation
    @notice similar to openzeppelin's implementation function (of upgradeableBeacon.sol)
    @notice note: even though contract is factory, implementation returns pool cause it is used by beacon proxy
    */
    function implementation(IFactory.PoolType poolType_) public view returns (address) {
        return
            poolType_ == IFactory.PoolType.PERSONAL_POOL ? personalPoolLogic : poolLogic;
    }

     /**
    @notice function to get pool logic implementation
    @notice similar to openzeppelin's implementation function (of upgradeableBeacon.sol)
    @notice note: even though contract is factory, implementation returns pool cause it is used by beacon proxy
    */
    function implementation() public view returns (address) {
        return
            poolType == IFactory.PoolType.PERSONAL_POOL ? personalPoolLogic : poolLogic;
    }
}
