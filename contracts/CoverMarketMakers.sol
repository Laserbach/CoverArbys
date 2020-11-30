// SPDX-License-Identifier: No License

pragma solidity 0.6.6;

import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IProtocolFactory {
  function getCovTokenAddress(bytes32 _protocolName, uint48 _timestamp, address _collateral, uint256 _claimNonce, bool _isClaimCovToken) external view returns (address);
}

interface IProtocol {
  function name() external view returns (bytes32);
  function claimNonce() external view returns (uint256);
  function addCover(address _collateral, uint48 _timestamp, uint256 _amount)
    external returns (bool);
}

interface IBalancerPool {
    function getBalance(address) external view returns (uint);
    function getNormalizedWeight(address) external view returns (uint);
    function joinPool(uint, uint[] calldata maxAmountsIn) external;
    function totalSupply() external view returns (uint);
    function getFinalTokens() external view returns (address[] memory tokens);
}

contract CoverMarketMakers {
    IProtocolFactory public factory;
    IERC20 public daiToken;

    // Initialize, called once
    constructor (
      IProtocolFactory _factory
    )
      public
    {
      factory = _factory;
    }

    // Mint CLAIM / NOCLAIM , depsit CLAIM and NOCLAIM in balancer and return BPTs
    function marketMaker(IProtocol _protocol, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _collateralAmount, address _collateral) external {
      IERC20(_collateral).transferFrom(msg.sender, address(this), _collateralAmount);
      if (IERC20(_collateral).allowance(address(this), address(_protocol)) < _collateralAmount) {
        IERC20(_collateral).approve(address(_protocol), uint256(-1));
      }
      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);

      IERC20 claimToken =  IERC20(claimTokenAddr);
      IERC20 noClaimToken =  IERC20(noclaimTokenAddr);

      uint256 mintAmount = (_collateralAmount / ( (1 ether) + _claimPool.getNormalizedWeight(_collateral) + _noclaimPool.getNormalizedWeight(_collateral)) ) * (10**18);

      uint256 collateralToProvideClaimPool = mintAmount / ((1 ether) / _claimPool.getNormalizedWeight(_collateral));
      uint256 collateralToProvideNoClaimPool = mintAmount / ((1 ether) / _noclaimPool.getNormalizedWeight(_collateral));

      require((IERC20(_collateral).balanceOf(address(this)) >= (mintAmount + collateralToProvideClaimPool + collateralToProvideNoClaimPool)), "ERR_COLLATERAL_AMOUNTS");

      _protocol.addCover(_collateral, _expiration, mintAmount);
      _provideLiquidity(_claimPool, claimToken, mintAmount, IERC20(_collateral), collateralToProvideClaimPool);
      _provideLiquidity(_noclaimPool, noClaimToken, mintAmount, IERC20(_collateral), collateralToProvideNoClaimPool);

      uint256 returnCollateralAmount = IERC20(_collateral).balanceOf(address(this));
      uint256 claimBptAmount =  IERC20(address(_claimPool)).balanceOf(address(this));
      uint256 noClaimBptAmount = IERC20(address(_noclaimPool)).balanceOf(address(this));
      require(IERC20(_collateral).transfer(msg.sender, returnCollateralAmount), "ERR_TRANSFER_FAILED");
      require(IERC20(address(_claimPool)).transfer(msg.sender, claimBptAmount), "ERR_TRANSFER_FAILED");
      require(IERC20(address(_noclaimPool)).transfer(msg.sender, noClaimBptAmount), "ERR_TRANSFER_FAILED");
    }

    function _provideLiquidity(IBalancerPool _bPool, IERC20 _token, uint256 _tokenAmount, IERC20 _collateral, uint256 _collateralAmount) private {
      if (_token.allowance(address(this), address(_bPool)) < _tokenAmount) {
        _token.approve(address(_bPool), uint256(-1));
      }
      if (_collateral.allowance(address(this), address(_bPool)) < _collateralAmount) {
        _collateral.approve(address(_bPool), uint256(-1));
      }

      uint256 poolBalance = _bPool.getBalance(address(_token));
      uint256 buffer = (1 ether * _tokenAmount) / 100 ether; // 1 % buffer
      uint256 bptAmount = (_bPool.totalSupply() / ( poolBalance / (_tokenAmount - buffer) ));

      uint[] memory maxAmountsIn = new uint[](2);
      address[] memory tokenAddresses = new address[](2);
      tokenAddresses = _bPool.getFinalTokens();

      if(tokenAddresses[0] == address(_collateral)){
        maxAmountsIn[0] = _collateralAmount;
        maxAmountsIn[1] = _tokenAmount;
      } else {
        maxAmountsIn[0] = _tokenAmount;
        maxAmountsIn[1] = _collateralAmount;
      }

      _bPool.joinPool(bptAmount, maxAmountsIn);
      require((IERC20(address(_bPool)).balanceOf(address(this)) == bptAmount), "LP_FAILED");
    }

    // for testing only
    function getPoolStats(IBalancerPool _bPool, address _token, uint256 _tokenAmount, address _collateral) external view returns(uint256, uint256, uint256, uint256, uint256, address[] memory tokens) {

      uint256 collateralAmountForGivenTokenAmount = _tokenAmount/((1 ether)/_bPool.getNormalizedWeight(_collateral));

      return (
        _bPool.getNormalizedWeight(_collateral),
        _bPool.getNormalizedWeight(_token),
        (_bPool.getBalance(_token) + _bPool.getBalance(_collateral)),
        _bPool.totalSupply(),
        collateralAmountForGivenTokenAmount,
        _bPool.getFinalTokens());
    }

    // for testing only
    function testingCalculations(IBalancerPool _bPool, address _collateral,address _token, uint256 _amount) external view returns(uint256, uint256) {

      uint256 mintAmount = (_amount / ( (1 ether) + _bPool.getNormalizedWeight(_collateral)) ) * (10**18);
      uint256 collateralToProvideClaimPool = mintAmount / ((1 ether) / _bPool.getNormalizedWeight(_collateral));

      uint256 poolBalance = _bPool.getBalance(address(_token)) + _bPool.getBalance(address(_collateral));
      uint256 bptAmount = _bPool.totalSupply() / ( poolBalance / (mintAmount + collateralToProvideClaimPool) );

      return (collateralToProvideClaimPool, bptAmount);
    }

    receive() external payable {}
}
