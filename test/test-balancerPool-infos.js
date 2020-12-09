const { assert } = require("chai");


const claimAddr = "0x2b8a2f0bad1ba4d72033b8475fb0ccc4921cb6dc"; // (Curve exmaple)
const balPoolAddrDaiClaim = "0xdfe5ead7bd050eb74009e7717000eeadcf0f18db";

let bpoolClaim;

describe("### GET POOL STATS", function() {
  before(async () => {
    deployer = ethers.provider.getSigner(0);

    const ERC20_CLAIM = await ethers.getContractFactory('CoverERC20');
    claim = ERC20_CLAIM.attach(claimAddr);

    bpoolClaim = await ethers.getContractAt("IBPool", balPoolAddrDaiClaim);
  });

  it("Get Amount of CLAIM Tokens in BPool", async function() {
    const amountClaimMinted = await claim.totalSupply();
    const amountClaimInPool = await bpoolClaim.getBalance(claimAddr)

    const amountClaimNotInPool = amountClaimMinted.sub(amountClaimInPool);

    console.log("Amount of CLAIM minted: " + ethers.utils.formatEther(amountClaimMinted).toString());
    console.log("Amount of CLAIM in BPool: " + ethers.utils.formatEther(amountClaimInPool).toString());
    console.log("Amount of CLAIM not in pool: " + ethers.utils.formatEther(amountClaimNotInPool).toString());
  });
});
