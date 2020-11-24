const { assert } = require("chai");

// Cover Protocol
const protocolFactory = "0xedfC81Bf63527337cD2193925f9C0cF2D537AccA";
const daiAddr = "0x6b175474e89094c44da98b954eedeac495271d0f";

// Coverage - Specific (Curve exmaple)
const coveredProtocolAddr = "0xc89432064d7cb658be730498dc07f1d850d6a867"; // Protocol.sol
const cover = "0x5104f23653df6695D9d2B91c952F47F9ffbDE744"; // Cover.sol
const balPoolAddrDaiClaim = "0x51a370f47a2def11e38ec529706cde52e7d4a333";
const balPoolAddrDaiNoClaim = "0xd9b92e84b9f96267bf548cfe3a3ae21773872138";
const coverageExpirationTime = 1622419200; // https://www.epochconverter.com/

// Only Required For Testing
const wethAddr = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const balPoolAddrDaiWeth = "0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81";
const claimAddr = "0x2b8a2f0bad1ba4d72033b8475fb0ccc4921cb6dc"; // (Curve exmaple)
const noClaimAddr = "0x1f8aa31e569fcf22e21eb124fdd46df1e990c36e"; // (Curve exmaple)

// Dex (only for testing)
let balancerWethDai;

// Coverage Provider Contract
let arbysMenu;

// balances
let daiAmountMint = 3000;
let daiAmountCp = 1000;
let daiAmountPr = 1000;
let daiArbyBuyAmount = 10;
let daiArbySellAmount = 10;

let balanceDai;
let balanceClaim;
let balanceNoClaim;

// erc20
let dai;
let claim;
let noClaim;

describe("### Acquire DAI", function() {
  before(async () => {
    deployer = ethers.provider.getSigner(0);

    const BalancerSwap = await ethers.getContractFactory("BalancerSwap");
    balancerWethDai = await BalancerSwap.deploy(balPoolAddrDaiWeth,daiAddr,wethAddr);
    await balancerWethDai.deployed();

    const ArbysMenu = await ethers.getContractFactory("ArbysMenu");
    arbysMenu = await ArbysMenu.deploy(protocolFactory,daiAddr);
    await arbysMenu.deployed();

    const ERC20_DAI = await ethers.getContractFactory('ERC20');
    dai = ERC20_DAI.attach(daiAddr);

    const ERC20_CLAIM = await ethers.getContractFactory('ERC20');
    claim = ERC20_CLAIM.attach(claimAddr);

    const ERC20_NOCLAIM = await ethers.getContractFactory('ERC20');
    noClaim = ERC20_NOCLAIM.attach(noClaimAddr);
  });

  it("should allow to swap ETH for DAI via Balancer (ETH - WETH - DAI)", async function() {
    daiAmountMint = ethers.utils.parseEther(daiAmountMint.toString());

    await balancerWethDai.pay(daiAmountMint, {value: ethers.utils.parseEther("100")});
    balanceDai = await dai.balanceOf(deployer.getAddress());
    assert.equal(ethers.utils.formatEther(balanceDai), ethers.utils.formatEther(daiAmountMint));
    console.log("Initial DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Execute Arbitrage Sell", () => {
  it("should take advantage of arbitrage opportunity", async function() {
    daiArbySellAmount = ethers.utils.parseEther(daiArbySellAmount.toString());
    let txApprove = await dai.approve(arbysMenu.address, daiArbySellAmount);
    await txApprove.wait();

    let calcArbySell = await arbysMenu.calcArbySell(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbySellAmount);

    let tx = await arbysMenu.arbitrageSell(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbySellAmount);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
    console.log("Calculated Arby: " + (ethers.utils.formatEther(calcArbySell)-ethers.utils.formatEther(daiArbySellAmount)).toString());
  });
});

describe("### Provide Coverage: Mint NOCLAIM / CLAM and sell CLAIM", () => {
  it("should allow minting CLAIM / NOCLAIM and selling CLAIM", async function() {
    daiAmountCp = ethers.utils.parseEther(daiAmountCp.toString());
    txApprove = await dai.approve(arbysMenu.address, daiAmountCp);
    await txApprove.wait();

    tx = await arbysMenu.provideCoverage(coveredProtocolAddr, balPoolAddrDaiClaim, coverageExpirationTime, daiAmountCp);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    assert.equal(ethers.utils.formatEther(balanceNoClaim), "1000.0");
    assert.equal(ethers.utils.formatEther(balanceClaim), "0.0");
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Provide NOCLAIM: Mint NOCLAIM / CLAM and sell NOCLAIM", () => {
  it("should allow minting CLAIM / NOCLAIM and selling NOCLAIM", async function() {
    daiAmountPr = ethers.utils.parseEther(daiAmountPr.toString());
    txApprove = await dai.approve(arbysMenu.address, daiAmountPr);
    await txApprove.wait();

    tx = await arbysMenu.shortNoclaim(coveredProtocolAddr, balPoolAddrDaiNoClaim, coverageExpirationTime, daiAmountPr);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    assert.equal(ethers.utils.formatEther(balanceNoClaim), "1000.0");
    assert.equal(ethers.utils.formatEther(balanceClaim), "1000.0");
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Execute Arbitrage Buy", () => {
  it("should take advantage of arbitrage opportunity", async function() {
    daiArbyBuyAmount = ethers.utils.parseEther(daiArbyBuyAmount.toString());
    txApprove = await dai.approve(arbysMenu.address, daiArbyBuyAmount);
    await txApprove.wait();

    let calcArbyBuy = await arbysMenu.calcArbyBuy(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbyBuyAmount);

    tx = await arbysMenu.arbitrageBuy(coveredProtocolAddr, cover, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbyBuyAmount);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
    console.log("Calculated Arby: " + (ethers.utils.formatEther(daiArbyBuyAmount) - ethers.utils.formatEther(calcArbyBuy)).toString());
  });
});
