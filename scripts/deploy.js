/**
 * Deployment script for TreasureHunt contract
 *
 * This script:
 * 1. Deploys the Verifier contract (generated from circuit)
 * 2. Deploys the TreasureHunt contract with Verifier address
 * 3. Saves deployment info for frontend use
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // Deploy Verifier contract (Groth16Verifier)
    console.log("📜 Deploying Groth16Verifier contract...");
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Groth16Verifier deployed to:", verifierAddress, "\n");

    // Deploy TreasureHunt contract
    console.log("🏴‍☠️ Deploying TreasureHunt contract...");
    const TreasureHunt = await hre.ethers.getContractFactory("TreasureHunt");
    const treasureHunt = await TreasureHunt.deploy(verifierAddress);
    await treasureHunt.waitForDeployment();
    const treasureHuntAddress = await treasureHunt.getAddress();
    console.log("✅ TreasureHunt deployed to:", treasureHuntAddress, "\n");

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        verifier: verifierAddress,
        treasureHunt: treasureHuntAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    const deploymentFile = path.join(
        deploymentsDir,
        `${hre.network.name}.json`
    );

    fs.writeFileSync(
        deploymentFile,
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("💾 Deployment info saved to:", deploymentFile);

    // Print summary
    console.log("\n📋 Deployment Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Network:", hre.network.name);
    console.log("Chain ID:", deploymentInfo.chainId);
    console.log("Verifier:", verifierAddress);
    console.log("TreasureHunt:", treasureHuntAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Verify contracts on Etherscan (if not local network)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("⏳ Waiting 30 seconds before verification...");
        await new Promise(resolve => setTimeout(resolve, 30000));

        try {
            console.log("\n🔍 Verifying Verifier contract...");
            await hre.run("verify:verify", {
                address: verifierAddress,
                constructorArguments: []
            });
            console.log("✅ Verifier verified!");
        } catch (error) {
            console.log("⚠️  Verifier verification failed:", error.message);
        }

        try {
            console.log("\n🔍 Verifying TreasureHunt contract...");
            await hre.run("verify:verify", {
                address: treasureHuntAddress,
                constructorArguments: [verifierAddress]
            });
            console.log("✅ TreasureHunt verified!");
        } catch (error) {
            console.log("⚠️  TreasureHunt verification failed:", error.message);
        }
    }

    console.log("\n🎉 Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
