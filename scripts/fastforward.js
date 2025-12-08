/**
 * Fast-forward blockchain time
 * Useful for testing time-dependent features like lockout periods
 */

const hre = require("hardhat");

async function main() {
    const days = parseInt(process.argv[2] || "2");
    const seconds = days * 24 * 60 * 60;

    console.log(`⏩ Fast-forwarding time by ${days} day(s) (${seconds} seconds)...`);

    // Increase time
    await hre.network.provider.send("evm_increaseTime", [seconds]);

    // Mine a new block to apply the time change
    await hre.network.provider.send("evm_mine");

    console.log(`✅ Time advanced by ${days} day(s)`);
    console.log(`💡 You can now claim hunts that were in lockout period`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
