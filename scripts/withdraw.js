/**
 * Example script: Withdraw prize money
 *
 * After claiming, winner can withdraw 50% per day
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const huntId = process.argv[2] || "0";

    console.log("💰 Withdrawing from hunt", huntId, "\n");

    // Load deployment
    const deploymentFile = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
    const deployment = JSON.parse(fs.readFileSync(deploymentFile));

    const [claimer] = await hre.ethers.getSigners();
    console.log("👤 Withdrawing as:", claimer.address, "\n");

    const TreasureHunt = await hre.ethers.getContractFactory("TreasureHunt");
    const treasureHunt = TreasureHunt.attach(deployment.treasureHunt);

    // Check if can withdraw
    const canWithdraw = await treasureHunt.canWithdraw(huntId);
    if (!canWithdraw) {
        console.log("⏳ Cannot withdraw yet. Reasons:");
        console.log("  - Must wait 24 hours between withdrawals");
        console.log("  - Hunt must be claimed");
        console.log("  - Must be the claimer");
        console.log("  - Pot must have funds");
        process.exit(1);
    }

    // Get current claim info
    const claim = await treasureHunt.getClaim(huntId);
    console.log("📊 Claim Information:");
    console.log("Claimer:", claim.claimer);
    console.log("Total withdrawn:", hre.ethers.formatEther(claim.totalWithdrawn), "ETH");
    console.log("Next withdrawal:", new Date(Number(claim.nextWithdrawalTime) * 1000).toLocaleString());
    console.log();

    // Get pot balance
    const potBalance = await treasureHunt.getPotBalance(huntId);
    const withdrawAmount = (potBalance * 50n) / 100n;

    console.log("💎 Current pot balance:", hre.ethers.formatEther(potBalance), "ETH");
    console.log("📤 Will withdraw:", hre.ethers.formatEther(withdrawAmount), "ETH\n");

    // Withdraw
    console.log("📤 Submitting withdrawal...");
    const tx = await treasureHunt.withdraw(huntId);
    console.log("⏳ Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!\n");

    // Get updated balance
    const newBalance = await hre.ethers.provider.getBalance(claimer.address);
    console.log("🎉 Withdrawal successful!");
    console.log("💰 New balance:", hre.ethers.formatEther(newBalance), "ETH\n");

    const remainingPot = await treasureHunt.getPotBalance(huntId);
    if (remainingPot > 0n) {
        console.log("📅 Remaining pot:", hre.ethers.formatEther(remainingPot), "ETH");
        console.log("⏰ Come back in 24 hours to withdraw again!");
    } else {
        console.log("🏆 Pot fully claimed! Hunt complete.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
