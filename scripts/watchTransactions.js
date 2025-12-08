/**
 * Watch and display transactions on local Hardhat network
 * Run: npx hardhat run scripts/watchTransactions.js --network localhost
 */

const hre = require("hardhat");

async function main() {
    console.log("👀 Watching for transactions on localhost:8545...\n");

    const provider = hre.ethers.provider;

    // Watch for new blocks
    provider.on("block", async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);

        if (block.transactions.length === 0) {
            return; // Skip empty blocks
        }

        console.log("\n" + "=".repeat(80));
        console.log(`📦 Block #${blockNumber}`);
        console.log(`   Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
        console.log(`   Gas Used: ${block.gasUsed.toString()}`);
        console.log(`   Transactions: ${block.transactions.length}`);

        // Get transaction details
        for (const txHash of block.transactions) {
            const tx = await provider.getTransaction(txHash);
            const receipt = await provider.getTransactionReceipt(txHash);

            console.log("\n   📝 Transaction:", txHash);
            console.log(`      From: ${tx.from}`);
            console.log(`      To: ${tx.to || '(Contract Creation)'}`);
            console.log(`      Value: ${hre.ethers.formatEther(tx.value)} ETH`);
            console.log(`      Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`      Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);

            // Decode contract calls if possible
            if (tx.data && tx.data !== '0x') {
                const methodId = tx.data.slice(0, 10);
                const methodNames = {
                    '0xdefcf3a5': 'claimTreasure()',
                    '0xa888c2cd': 'createHunt()',
                    '0x2e1a7d4d': 'withdraw()',
                    '0xfbe85f06': 'purchaseHint()'
                };
                const methodName = methodNames[methodId] || methodId;
                console.log(`      Method: ${methodName}`);
            }

            // Show events
            if (receipt.logs.length > 0) {
                console.log(`      Events: ${receipt.logs.length}`);
                for (const log of receipt.logs) {
                    try {
                        // Try to decode if it's from TreasureHunt contract
                        const iface = new hre.ethers.Interface([
                            "event HuntCreated(uint256 indexed huntId, address indexed hider, uint256 locationCommitment, uint256 prize, uint256 claimableAfter)",
                            "event ClaimSubmitted(uint256 indexed huntId, address indexed claimer)",
                            "event Withdrawal(uint256 indexed huntId, address indexed claimer, uint256 amount)",
                            "event HintPurchased(uint256 indexed huntId, address indexed seeker, uint256 amount)"
                        ]);
                        const parsed = iface.parseLog(log);
                        console.log(`         - ${parsed.name}`);
                        if (parsed.name === 'HuntCreated') {
                            console.log(`           Hunt ID: ${parsed.args.huntId}`);
                            console.log(`           Prize: ${hre.ethers.formatEther(parsed.args.prize)} ETH`);
                        }
                    } catch (e) {
                        // Not a TreasureHunt event, skip
                    }
                }
            }
        }
    });

    console.log("Press Ctrl+C to stop\n");

    // Keep the script running
    await new Promise(() => {});
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
