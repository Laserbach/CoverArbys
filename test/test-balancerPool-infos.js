const { assert } = require("chai");


const claimAddr = "0x2b8a2f0bad1ba4d72033b8475fb0ccc4921cb6dc"; // (Curve exmaple)
const daiAddr = "0x6b175474e89094c44da98b954eedeac495271d0f"; // collateral
const balPoolAddrDaiClaim = "0xdfe5ead7bd050eb74009e7717000eeadcf0f18db";

let bpoolClaim;
let amountClaimInPool;
let amountDaiInPool;

describe("### GET POOL STATS", function() {
  before(async () => {
    deployer = ethers.provider.getSigner(0);

    const ERC20_CLAIM = await ethers.getContractFactory('CoverERC20');
    claim = ERC20_CLAIM.attach(claimAddr);

    bpoolClaim = await ethers.getContractAt("BPool", balPoolAddrDaiClaim);
  });

  it("Get Amount of CLAIM Tokens in BPool", async function() {
    const amountClaimMinted = await claim.totalSupply();
    amountClaimInPool = await bpoolClaim.getBalance(claimAddr)

    const amountClaimNotInPool = amountClaimMinted.sub(amountClaimInPool);

    console.log("Amount of CLAIM minted: " + ethers.utils.formatEther(amountClaimMinted).toString());
    console.log("Amount of CLAIM in BPool: " + ethers.utils.formatEther(amountClaimInPool).toString());
    console.log("Amount of CLAIM not in pool: " + ethers.utils.formatEther(amountClaimNotInPool).toString());
  });

  it("Calculate volume / fees needed to push CLAIM price to 1 DAI", async function() {

    amountDaiInPool = await bpoolClaim.getBalance(daiAddr);
    const oneEther = ethers.utils.parseEther("1");

    // weight
    const weightClaim = await bpoolClaim.getNormalizedWeight(claimAddr);
    const weightDai = await bpoolClaim.getNormalizedWeight(daiAddr);

    // price
    const fetchedClaimPrice = await bpoolClaim.getSpotPrice(daiAddr, claimAddr);

    // calc
    const daiFactor = (weightDai.mul(amountClaimInPool).mul(oneEther)).div((weightClaim.mul(amountDaiInPool)));
    const volumeRequired = ((amountDaiInPool.mul(daiFactor)).div(oneEther)).sub(amountDaiInPool); // volume needed for 1 CLAIM = 1 DAI
    const swapFee = await bpoolClaim.getSwapFee();
    const feesEarnedOnVolume = volumeRequired.mul(swapFee).div(oneEther);

    console.log("Amount of DAI in BPool: " + ethers.utils.formatEther(amountDaiInPool).toString());
    console.log("Amount of CLAIM in BPool: " + ethers.utils.formatEther(amountClaimInPool).toString());
    console.log("Fetched current CLAIM price: " + ethers.utils.formatEther(fetchedClaimPrice).toString());
    console.log("Weight CLAIM: "+ethers.utils.formatEther(weightClaim).toString()+" __ Weight DAI: "+ethers.utils.formatEther(weightDai).toString());
    console.log("DAI multiplicator to reach 1 DAI = 1 CLAIM: "+ethers.utils.formatEther(daiFactor).toString());
    console.log("Volume required for 1 CLAIM = 1 DAI: "+ethers.utils.formatEther(volumeRequired).toString()+" __ Fees earned: "+ethers.utils.formatEther(feesEarnedOnVolume).toString());
  });
});
