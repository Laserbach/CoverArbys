// File contracts/interfaces/IERC20.sol

// SPDX-License-Identifier: No License

pragma solidity 0.6.6;

/**
 * @title Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}


// File contracts/interfaces/IProtocolFactory.sol

// SPDX-License-Identifier: No License

pragma solidity 0.6.6;

/**
 * @dev ProtocolFactory contract interface. See {ProtocolFactory}.
 * @author crypto-pumpkin@github
 */
interface IProtocolFactory {
  /// @notice return contract address, the contract may not be deployed yet
  function getCovTokenAddress(bytes32 _protocolName, uint48 _timestamp, address _collateral, uint256 _claimNonce, bool _isClaimCovToken) external view returns (address);
}


// File contracts/interfaces/IProtocol.sol

// SPDX-License-Identifier: No License

pragma solidity 0.6.6;

/**
 * @dev Protocol contract interface. See {Protocol}.
 * @author crypto-pumpkin@github
 */
interface IProtocol {
  function name() external view returns (bytes32);
  function claimNonce() external view returns (uint256);
  function addCover(address _collateral, uint48 _timestamp, uint256 _amount)
    external returns (bool);
}


// File contracts/interfaces/IBalancerPool.sol

// SPDX-License-Identifier: No License

pragma solidity 0.6.6;

interface IBalancerPool {
    function swapExactAmountIn(address, uint, address, uint, uint) external returns (uint, uint);
}


// File contracts/Minter.sol

// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

contract ArbysMenu {
    IProtocolFactory public factory;
    IERC20 public daiToken;

    // Initialize, called once
    constructor (
      IProtocolFactory _factory,
      IERC20 daiToken_
    )
      public
    {
      factory = _factory;
      daiToken = daiToken_;
    }

    function provideCoverage(IProtocol _protocol, IBalancerPool _claimPool, uint48 _expiration, uint256 _daiAmount) external {
      daiToken.transferFrom(msg.sender, address(this), _daiAmount);
      if (daiToken.allowance(address(this), address(_protocol)) < _daiAmount) {
        daiToken.approve(address(_protocol), uint256(-1));
      }
      _protocol.addCover(address(daiToken), _expiration, _daiAmount);

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, address(daiToken), _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, address(daiToken), _protocol.claimNonce(), true);

      IERC20 claimToken =  IERC20(claimTokenAddr);
      IERC20 noClaimToken =  IERC20(noclaimTokenAddr);

      _swapTokenForDai(_claimPool, claimToken, _daiAmount);

      uint256 daiAmount = daiToken.balanceOf(address(this));
      require(daiToken.transfer(msg.sender, daiAmount), "ERR_TRANSFER_FAILED");
      require(noClaimToken.transfer(msg.sender, _daiAmount), "ERR_TRANSFER_FAILED");
    }

    function arbitrageSell(IProtocol _protocol, IBalancerPool _claimPool, IBalancerPool _noclaimPool, uint48 _expiration, uint _daiAmount) external {
      daiToken.transferFrom(msg.sender, address(this), _daiAmount);
      if (daiToken.allowance(address(this), address(_protocol)) < _daiAmount) {
        daiToken.approve(address(_protocol), uint256(-1));
      }
      _protocol.addCover(address(daiToken), _expiration, _daiAmount);

      address noclaimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, address(daiToken), _protocol.claimNonce(), false);
      address claimTokenAddr = factory.getCovTokenAddress(_protocol.name(), _expiration, address(daiToken), _protocol.claimNonce(), true);

      _swapTokenForDai(_noclaimPool, IERC20(noclaimTokenAddr), _daiAmount);
      _swapTokenForDai(_claimPool, IERC20(claimTokenAddr), _daiAmount);

      uint256 bal = daiToken.balanceOf(address(this));
      require(bal > _daiAmount, "No arbys");
      require(daiToken.transfer(msg.sender, bal), "ERR_TRANSFER_FAILED");
    }

    function _swapTokenForDai(IBalancerPool _bPool, IERC20 token, uint _sellAmount) private {
        if (token.allowance(address(this), address(_bPool)) < _sellAmount) {
          token.approve(address(_bPool), uint256(-1));
        }
        IBalancerPool(_bPool).swapExactAmountIn(
            address(token),
            _sellAmount,
            address(daiToken),
            0, // minAmountOut, set to 0 -> sell no matter how low the price of CLAIM tokens are
            uint256(-1) // maxPrice, set to max -> accept any swap prices
        );
    }

    receive() external payable {}
}
