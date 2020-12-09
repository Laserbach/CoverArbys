const { assert } = require("chai");

// Cover Protocol
const protocolFactory = "0xedfC81Bf63527337cD2193925f9C0cF2D537AccA";
const daiAddr = "0x6b175474e89094c44da98b954eedeac495271d0f"; // collateral

// Coverage - Specific (Curve exmaple)
const coveredProtocolAddr = "0xc89432064d7cb658be730498dc07f1d850d6a867"; // Protocol.sol
const cover = "0x5104f23653df6695D9d2B91c952F47F9ffbDE744"; // Cover.sol
const balPoolAddrDaiClaim = "0xdfe5ead7bd050eb74009e7717000eeadcf0f18db";
const balPoolAddrDaiNoClaim = "0xd9b92e84b9f96267bf548cfe3a3ae21773872138";
const coverageExpirationTime = 1622419200; // https://www.epochconverter.com/

// Only Required For Testing
const wethAddr = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const balPoolAddrDaiWeth = "0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81";
const claimAddr = "0x2b8a2f0bad1ba4d72033b8475fb0ccc4921cb6dc"; // (Curve exmaple)
const noClaimAddr = "0x1f8aa31e569fcf22e21eb124fdd46df1e990c36e"; // (Curve exmaple)

// Dex (only for testing)
let balancerWethDai;

// MM Contract
let coverMarketMaker;

// balances
let daiAmountMint = 20000;

let balanceDai;
let balanceClaim;
let balanceNoClaim;

// erc20
let dai;
let claim;
let noClaim;
let bptDaiClaim;
let bptDaiNoClaim;

describe("### Acquire DAI", function() {
  before(async () => {
    deployer = ethers.provider.getSigner(0);

    const BalancerSwap = await ethers.getContractFactory("BalancerSwap");
    balancerWethDai = await BalancerSwap.deploy(balPoolAddrDaiWeth,daiAddr,wethAddr);
    await balancerWethDai.deployed();

    const CoverMarketMakers = await ethers.getContractFactory("CoverMarketMakers");
    coverMarketMaker = await CoverMarketMakers.deploy(protocolFactory);
    await coverMarketMaker.deployed();

    const ERC20_DAI = await ethers.getContractFactory('CoverERC20');
    dai = ERC20_DAI.attach(daiAddr);

    const ERC20_CLAIM = await ethers.getContractFactory('CoverERC20');
    claim = ERC20_CLAIM.attach(claimAddr);

    const ERC20_NOCLAIM = await ethers.getContractFactory('CoverERC20');
    noClaim = ERC20_NOCLAIM.attach(noClaimAddr);

    const ERC20_BPT_DAI_CLAIM = await ethers.getContractFactory('CoverERC20');
    bptDaiClaim = ERC20_BPT_DAI_CLAIM.attach(balPoolAddrDaiClaim);

    const ERC20_BPT_DAI_NOCLAIM = await ethers.getContractFactory('CoverERC20');
    bptDaiNoClaim = ERC20_BPT_DAI_NOCLAIM.attach(balPoolAddrDaiNoClaim);
  });

  it("should allow to swap ETH for DAI via Balancer (ETH - WETH - DAI)", async function() {
    this.timeout(40000);
    daiAmountMint = ethers.utils.parseEther(daiAmountMint.toString());

    await balancerWethDai.pay(daiAmountMint, {value: ethers.utils.parseEther("100")});
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("Minted DAI: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Market Maker 1: Deposit and Withdraw", () => {
  it("should mint coverage and deposit in balancer, receive BPT tokens back", async function() {
    this.timeout(40000);
    balanceDai = await dai.balanceOf(deployer.getAddress());

    let covAmount = ethers.utils.parseEther("1000");

    let collateralAmountClaimPool = await coverMarketMaker.getCollateralAmountLp(balPoolAddrDaiClaim, claimAddr, daiAddr, covAmount);
    let collateralAmountNoClaimPool = await coverMarketMaker.getCollateralAmountLp(balPoolAddrDaiNoClaim, noClaimAddr, daiAddr, covAmount);
    let daiAmountLp = collateralAmountClaimPool.add(collateralAmountNoClaimPool);

    let txApprove = await dai.approve(coverMarketMaker.address, covAmount.add(daiAmountLp));
    await txApprove.wait();

    let tx = await coverMarketMaker.marketMakerDeposit(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, covAmount, daiAmountLp, daiAddr);

    let balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    let balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());
    let balanceClaim = await claim.balanceOf(deployer.getAddress());
    let balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    console.log("DAI deposited: " + ethers.utils.formatEther(covAmount.add(daiAmountLp)).toString());
    console.log("CLAIM balance: " + ethers.utils.formatEther(balanceClaim).toString());
    console.log("CLAIM-BPT balance: " + ethers.utils.formatEther(balanceClaimBpt).toString());
    console.log("NOCLAIM balance: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("NOCLAIM-BPT balance: " + ethers.utils.formatEther(balanceNoClaimBpt).toString());
  });
  it("should withdraw liquidity from both balancer cov-tokenpair pools", async function() {
    this.timeout(40000);

    balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());

    txApprove = await bptDaiClaim.approve(coverMarketMaker.address, balanceClaimBpt);
    await txApprove.wait();
    txApprove = await bptDaiNoClaim.approve(coverMarketMaker.address, balanceNoClaimBpt);
    await txApprove.wait();

    tx = await coverMarketMaker.marketMakerWithdraw(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiAddr, balanceClaimBpt, balanceNoClaimBpt);

    balanceDai = await dai.balanceOf(deployer.getAddress());
    balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());
    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());

    console.log("CLAIM balance: " + ethers.utils.formatEther(balanceClaim).toString());
    console.log("CLAIM-BPT balance: " + ethers.utils.formatEther(balanceClaimBpt).toString());
    console.log("NOCLAIM balance: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("NOCLAIM-BPT balance: " + ethers.utils.formatEther(balanceNoClaimBpt).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Market Maker 2: Deposit and Withdraw + Redeem", () => {
  it("should mint coverage and deposit in balancer, receive BPT tokens back", async function() {
    this.timeout(40000);
    balanceDai = await dai.balanceOf(deployer.getAddress());

    let covAmount = ethers.utils.parseEther("10000");

    collateralAmountClaimPool = await coverMarketMaker.getCollateralAmountLp(balPoolAddrDaiClaim, claimAddr, daiAddr, covAmount);
    collateralAmountNoClaimPool = await coverMarketMaker.getCollateralAmountLp(balPoolAddrDaiNoClaim, noClaimAddr, daiAddr, covAmount);
    daiAmountLp = collateralAmountClaimPool.add(collateralAmountNoClaimPool);

    let txApprove = await dai.approve(coverMarketMaker.address, covAmount.add(daiAmountLp));
    await txApprove.wait();

    let tx = await coverMarketMaker.marketMakerDeposit(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, covAmount, daiAmountLp, daiAddr);

    let balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    let balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());
    let balanceClaim = await claim.balanceOf(deployer.getAddress());
    let balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    console.log("DAI deposited: " + ethers.utils.formatEther(covAmount.add(daiAmountLp)).toString());
    console.log("CLAIM balance: " + ethers.utils.formatEther(balanceClaim).toString());
    console.log("CLAIM-BPT balance: " + ethers.utils.formatEther(balanceClaimBpt).toString());
    console.log("NOCLAIM balance: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("NOCLAIM-BPT balance: " + ethers.utils.formatEther(balanceNoClaimBpt).toString());
  });
  it("should withdraw liquidity from both balancer cov-tokenpair pools and redeem", async function() {
    this.timeout(40000);

    balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());

    txApprove = await bptDaiClaim.approve(coverMarketMaker.address, balanceClaimBpt);
    await txApprove.wait();
    txApprove = await bptDaiNoClaim.approve(coverMarketMaker.address, balanceNoClaimBpt);
    await txApprove.wait();

    tx = await coverMarketMaker.marketMakerWithdrawAndRedeem(coveredProtocolAddr, cover, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiAddr, balanceClaimBpt, balanceNoClaimBpt);

    balanceDai = await dai.balanceOf(deployer.getAddress());
    balanceClaimBpt = await bptDaiClaim.balanceOf(deployer.getAddress());
    balanceNoClaimBpt = await bptDaiNoClaim.balanceOf(deployer.getAddress());
    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());

    console.log("CLAIM balance: " + ethers.utils.formatEther(balanceClaim).toString());
    console.log("CLAIM-BPT balance: " + ethers.utils.formatEther(balanceClaimBpt).toString());
    console.log("NOCLAIM balance: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("NOCLAIM-BPT balance: " + ethers.utils.formatEther(balanceNoClaimBpt).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});
