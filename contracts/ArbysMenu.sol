// SPDX-License-Identifier: No License

pragma solidity ^0.7.5;

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

interface ICover {
  function redeemCollateral(uint256 _amount) external;
}

interface IBalancerPool {
    function swapExactAmountIn(address, uint, address, uint, uint) external returns (uint, uint);
    function swapExactAmountOut(address, uint, address, uint, uint) external returns (uint, uint);
    function calcOutGivenIn(uint, uint, uint, uint, uint, uint) external pure returns (uint);
    function calcInGivenOut(uint, uint, uint, uint, uint, uint) external pure returns (uint);
    function getBalance(address) external view returns (uint);
    function getSwapFee() external view returns (uint);
    function getNormalizedWeight(address) external view returns (uint);
}

contract ArbysMenu {
    IProtocolFactory public factory;
    IERC20 public daiToken;

    // Initialize, called once
    constructor (IProtocolFactory _factory) {
      factory = _factory;
    }

    // Mint CLAIM / NOCLAIM , sell CLAIM , return DAI premium + NOCLAIM
    function provideCoverage(IProtocol _protocol, IBalancerPool _claimPool, uint48 _expiration, uint256 _collateralAmount, address _collateral) external {
      IERC20(_collateral).transferFrom(msg.sender, address(this), _collateralAmount);
      if (IERC20(_collateral).allowance(address(this), address(_protocol)) < _collateralAmount) {
        IERC20(_collateral).approve(address(_protocol), uint256(-1));
      }
      _protocol.addCover(_collateral, _expiration, _collateralAmount);

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);

      IERC20 claimToken =  IERC20(claimTokenAddr);
      IERC20 noClaimToken =  IERC20(noclaimTokenAddr);

      _swapTokenForCollateral(_claimPool, claimToken, _collateralAmount, IERC20(_collateral));

      uint256 returnCollateralAmount = IERC20(_collateral).balanceOf(address(this));
      require(IERC20(_collateral).transfer(msg.sender, returnCollateralAmount), "ERR_TRANSFER_FAILED");
      require(noClaimToken.transfer(msg.sender, _collateralAmount), "ERR_TRANSFER_FAILED");
    }

    // Mint CLAIM / NOCLAIM , sell NOCLAIM , return DAI premium + CLAIM
    function shortNoclaim(IProtocol _protocol, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _collateralAmount, address _collateral) external {
      IERC20(_collateral).transferFrom(msg.sender, address(this), _collateralAmount);
      if (IERC20(_collateral).allowance(address(this), address(_protocol)) < _collateralAmount) {
        IERC20(_collateral).approve(address(_protocol), uint256(-1));
      }
      _protocol.addCover(_collateral, _expiration, _collateralAmount);

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);

      IERC20 claimToken =  IERC20(claimTokenAddr);
      IERC20 noClaimToken =  IERC20(noclaimTokenAddr);

      _swapTokenForCollateral(_noclaimPool, noClaimToken, _collateralAmount, IERC20(_collateral));

      uint256 returnCollateralAmount = IERC20(_collateral).balanceOf(address(this));
      require(IERC20(_collateral).transfer(msg.sender, returnCollateralAmount), "ERR_TRANSFER_FAILED");
      require(claimToken.transfer(msg.sender, _collateralAmount), "ERR_TRANSFER_FAILED");
    }

    function arbitrageSell(IProtocol _protocol, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _collateralAmount, address _collateral) external {
      IERC20(_collateral).transferFrom(msg.sender, address(this), _collateralAmount);
      if (IERC20(_collateral).allowance(address(this), address(_protocol)) < _collateralAmount) {
        IERC20(_collateral).approve(address(_protocol), uint256(-1));
      }
      _protocol.addCover(_collateral, _expiration, _collateralAmount);

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);

      _swapTokenForCollateral(_noclaimPool, IERC20(noclaimTokenAddr), _collateralAmount, IERC20(_collateral));
      _swapTokenForCollateral(_claimPool, IERC20(claimTokenAddr), _collateralAmount, IERC20(_collateral));

      uint256 bal = IERC20(_collateral).balanceOf(address(this));
      require(bal > _collateralAmount, "No arbys");
      require(IERC20(_collateral).transfer(msg.sender, bal), "ERR_TRANSFER_FAILED");
    }

    function arbitrageBuy(IProtocol _protocol, ICover _cover, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _collateralAmount, address _collateral) external {
      IERC20(_collateral).transferFrom(msg.sender, address(this), _collateralAmount);
      /* if (IERC20(_collateral).allowance(address(this), address(_protocol)) < _collateralAmount) {
        IERC20(_collateral).approve(address(_protocol), uint256(-1));
      } */

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);

      _swapCollateralForToken(_noclaimPool, IERC20(noclaimTokenAddr), _collateralAmount, IERC20(_collateral));
      _swapCollateralForToken(_claimPool, IERC20(claimTokenAddr), _collateralAmount, IERC20(_collateral));

      _cover.redeemCollateral(_collateralAmount);

      uint256 bal = IERC20(_collateral).balanceOf(address(this));
      require(bal > _collateralAmount, "No arbys");
      require(IERC20(_collateral).transfer(msg.sender, bal), "ERR_TRANSFER_FAILED");
    }

    function _swapTokenForCollateral(IBalancerPool _bPool, IERC20 _token, uint256 _sellAmount, IERC20 _collateral) private {
        if (_token.allowance(address(this), address(_bPool)) < _sellAmount) {
          _token.approve(address(_bPool), uint256(-1));
        }
        IBalancerPool(_bPool).swapExactAmountIn(
            address(_token),
            _sellAmount,
            address(_collateral),
            0, // minAmountOut, set to 0 -> sell no matter how low the price of CLAIM tokens are
            uint256(-1) // maxPrice, set to max -> accept any swap prices
        );
    }

    function _swapCollateralForToken(IBalancerPool _bPool, IERC20 _token, uint256 _buyAmount, IERC20 _collateral) private {
        if (_collateral.allowance(address(this), address(_bPool)) < _buyAmount) {
          _collateral.approve(address(_bPool), uint256(-1));
        }
        IBalancerPool(_bPool).swapExactAmountOut(
            address(_collateral),
            uint256(-1), // maxAmountIn, set to max -> use all sent DAI
            address(_token),
            _buyAmount,
            uint256(-1) // maxPrice, set to max -> accept any swap prices
            );
    }

    function calcArbySell(IProtocol _protocol, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _sellAmount, address _collateral) external view returns(uint256) {
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);
      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);

      uint256 collateralFromSellingClaim = IBalancerPool(_claimPool).calcOutGivenIn(
        IBalancerPool(_claimPool).getBalance(claimTokenAddr),
        IBalancerPool(_claimPool).getNormalizedWeight(claimTokenAddr),
        IBalancerPool(_claimPool).getBalance(_collateral),
        IBalancerPool(_claimPool).getNormalizedWeight(_collateral),
        _sellAmount,
        IBalancerPool(_claimPool).getSwapFee());

      uint256 daiFromSellingNoClaim = IBalancerPool(_noclaimPool).calcOutGivenIn(
        IBalancerPool(_noclaimPool).getBalance(noclaimTokenAddr),
        IBalancerPool(_noclaimPool).getNormalizedWeight(noclaimTokenAddr),
        IBalancerPool(_noclaimPool).getBalance(_collateral),
        IBalancerPool(_noclaimPool).getNormalizedWeight(_collateral),
        _sellAmount,
        IBalancerPool(_noclaimPool).getSwapFee());

      return (collateralFromSellingClaim + daiFromSellingNoClaim);
    }

    function calcArbyBuy(IProtocol _protocol, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint256 _buyAmount, address _collateral) external view returns(uint256) {
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), true);
      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, _collateral, _protocol.claimNonce(), false);

      uint256 collateralCostClaim = IBalancerPool(_claimPool).calcInGivenOut(
        IBalancerPool(_claimPool).getBalance(_collateral),
        IBalancerPool(_claimPool).getNormalizedWeight(_collateral),
        IBalancerPool(_claimPool).getBalance(claimTokenAddr),
        IBalancerPool(_claimPool).getNormalizedWeight(claimTokenAddr),
        _buyAmount,
        IBalancerPool(_claimPool).getSwapFee());

      uint256 collateralCostNoClaim = IBalancerPool(_noclaimPool).calcInGivenOut(
        IBalancerPool(_noclaimPool).getBalance(_collateral),
        IBalancerPool(_noclaimPool).getNormalizedWeight(_collateral),
        IBalancerPool(_noclaimPool).getBalance(noclaimTokenAddr),
        IBalancerPool(_noclaimPool).getNormalizedWeight(noclaimTokenAddr),
        _buyAmount,
        IBalancerPool(_noclaimPool).getSwapFee());

      return (collateralCostClaim + collateralCostNoClaim);
    }

    receive() external payable {}
}
