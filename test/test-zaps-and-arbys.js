const { assert } = require("chai");

// Arbys ArbysMenu
const arbysMenuAddr = "0xfc519C02088BB473c798efa22ef15bD95c26210f";

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

// Arbys Contract
let arbysMenu;

// balances
let daiAmountMint = 20000;
let daiAmountCp = 1000;
let daiAmountPr = 1000;
let daiArbyBuyAmount = 10;
let daiArbyBuyAmountLarge = 10000;
let daiArbySellAmount = 10;

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

    const ArbysMenu = await ethers.getContractFactory("ArbysMenu");
    arbysMenu = ArbysMenu.attach(arbysMenuAddr);

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

describe("### Execute Arbitrage Sell", () => {
  it("should take advantage of arbitrage opportunity", async function() {
    this.timeout(40000);
    daiArbySellAmount = ethers.utils.parseEther(daiArbySellAmount.toString());
    txApprove = await dai.approve(arbysMenu.address, daiArbySellAmount);
    await txApprove.wait();

    let calcArbySell = await arbysMenu.calcArbySell(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbySellAmount, daiAddr);

    tx = await arbysMenu.arbitrageSell(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbySellAmount, daiAddr);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
    console.log("Calculated Arby: " + (ethers.utils.formatEther(calcArbySell)-ethers.utils.formatEther(daiArbySellAmount)).toString());
  });
});

describe("### ZAP Provide Coverage: Mint NOCLAIM / CLAM and sell CLAIM", () => {
  it("should allow minting CLAIM / NOCLAIM and selling CLAIM", async function() {
    daiAmountCp = ethers.utils.parseEther(daiAmountCp.toString());
    txApprove = await dai.approve(arbysMenu.address, daiAmountCp);
    await txApprove.wait();

    tx = await arbysMenu.provideCoverage(coveredProtocolAddr, balPoolAddrDaiClaim, coverageExpirationTime, daiAmountCp, daiAddr);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### ZAP Provide NOCLAIM: Mint NOCLAIM / CLAM and sell NOCLAIM", () => {
  it("should allow minting CLAIM / NOCLAIM and selling NOCLAIM", async function() {
    daiAmountPr = ethers.utils.parseEther(daiAmountPr.toString());
    txApprove = await dai.approve(arbysMenu.address, daiAmountPr);
    await txApprove.wait();

    tx = await arbysMenu.shortNoclaim(coveredProtocolAddr, balPoolAddrDaiNoClaim, coverageExpirationTime, daiAmountPr, daiAddr);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
  });
});

describe("### Execute Arbitrage Buy", () => {
  it("should take advantage of arbitrage opportunity", async function() {
    daiArbyBuyAmount = ethers.utils.parseEther(daiArbyBuyAmount.toString());
    daiArbyBuyAmountLarge = ethers.utils.parseEther(daiArbyBuyAmountLarge.toString());
    txApprove = await dai.approve(arbysMenu.address, daiArbyBuyAmountLarge);
    await txApprove.wait();

    let calcArbyBuy = await arbysMenu.calcArbyBuy(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbyBuyAmount, daiAddr);
    let calcArbyBuyMedium = await arbysMenu.calcArbyBuy(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, ethers.utils.parseEther("1000"), daiAddr);
    let calcArbyBuyLarge = await arbysMenu.calcArbyBuy(coveredProtocolAddr, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbyBuyAmountLarge, daiAddr);

    tx = await arbysMenu.arbitrageBuy(coveredProtocolAddr, cover, balPoolAddrDaiClaim, balPoolAddrDaiNoClaim, coverageExpirationTime, daiArbyBuyAmount, daiAddr);
    await tx.wait();

    balanceClaim = await claim.balanceOf(deployer.getAddress());
    balanceNoClaim = await noClaim.balanceOf(deployer.getAddress());
    balanceDai = await dai.balanceOf(deployer.getAddress());
    console.log("CLAIM: " + ethers.utils.formatEther(balanceClaim).toString() + " and NOCLAIM: " + ethers.utils.formatEther(balanceNoClaim).toString());
    console.log("DAI balance: " + ethers.utils.formatEther(balanceDai).toString());
    console.log("Calculated Arby: " + (ethers.utils.formatEther(daiArbyBuyAmount) - ethers.utils.formatEther(calcArbyBuy)).toString());
    console.log("Calculated Arby Medium: " + (1000 - ethers.utils.formatEther(calcArbyBuyMedium)).toString());
    console.log("Calculated Arby Large: " + (ethers.utils.formatEther(daiArbyBuyAmountLarge) - ethers.utils.formatEther(calcArbyBuyLarge)).toString());
  });
});
