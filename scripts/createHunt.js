/**
 * Example script: Create a treasure hunt
 *
 * This demonstrates how a hider creates a new treasure hunt:
 * 1. Choose GPS location
 * 2. Generate random secret
 * 3. Compute location commitment
 * 4. Deploy hunt with initial prize
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { computeLocationCommitment, generateSecret } = require("../utils/hash");
const { degreesToScaled, RADIUS_SQUARED, formatCoordinates } = require("../utils/gps");

async function main() {
    console.log("🏴‍☠️ Creating a new treasure hunt...\n");

    // Load deployment info
    const deploymentFile = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
    if (!fs.existsSync(deploymentFile)) {
        console.error("❌ Deployment file not found. Run deploy.js first!");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile));
    console.log("📍 Using TreasureHunt contract at:", deployment.treasureHunt, "\n");

    // Get hider account
    const [hider] = await hre.ethers.getSigners();
    console.log("🎭 Hider address:", hider.address, "\n");

    // Configure hunt parameters
    const huntConfig = {
        // Example: San Francisco (Golden Gate Park)
        gpsLat: 37.7694,    // degrees
        gpsLon: -122.4862,  // degrees

        // Or use custom coordinates (prompt user in real app)
        // gpsLat: parseFloat(process.argv[2] || 37.7694),
        // gpsLon: parseFloat(process.argv[3] || -122.4862),

        prizeEth: "0.01",    // Initial prize in ETH
        lockoutDays: 0,      // No lockout (hider can claim immediately)
        durationDays: 14,    // Hunt expires after 14 days
        hintPriceEth: "0.001" // Cost to buy a hint
    };

    console.log("🎯 Hunt Configuration:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Location:", formatCoordinates(
        degreesToScaled(huntConfig.gpsLat),
        degreesToScaled(huntConfig.gpsLon),
        true
    ));
    console.log("Radius: ~10 meters");
    console.log("Prize:", huntConfig.prizeEth, "ETH");
    console.log("Lockout:", huntConfig.lockoutDays, "days");
    console.log("Duration:", huntConfig.durationDays, "days");
    console.log("Hint price:", huntConfig.hintPriceEth, "ETH");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Generate secret for QR code
    console.log("🔐 Generating secret...");
    const secret = generateSecret();
    console.log("Secret (keep this safe!):", secret.toString());

    // Convert GPS to scaled coordinates
    const latScaled = degreesToScaled(huntConfig.gpsLat);
    const lonScaled = degreesToScaled(huntConfig.gpsLon);

    console.log("\n📐 Scaled coordinates:");
    console.log("Latitude:", latScaled);
    console.log("Longitude:", lonScaled);
    console.log("Radius²:", RADIUS_SQUARED, "\n");

    // Compute location commitment
    console.log("🔨 Computing location commitment...");
    const locationCommitment = await computeLocationCommitment(
        latScaled,
        lonScaled,
        RADIUS_SQUARED
    );
    console.log("Location commitment:", locationCommitment, "\n");

    // Create hunt on-chain
    console.log("📤 Creating hunt on blockchain...");
    const TreasureHunt = await hre.ethers.getContractFactory("TreasureHunt");
    const treasureHunt = TreasureHunt.attach(deployment.treasureHunt);

    const lockoutSeconds = huntConfig.lockoutDays * 24 * 60 * 60;
    const durationSeconds = huntConfig.durationDays * 24 * 60 * 60;
    const prizeWei = hre.ethers.parseEther(huntConfig.prizeEth);
    const hintPriceWei = hre.ethers.parseEther(huntConfig.hintPriceEth);

    const tx = await treasureHunt.createHunt(
        locationCommitment,
        lockoutSeconds,
        durationSeconds,
        hintPriceWei,
        { value: prizeWei }
    );

    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!\n");

    // Extract hunt ID from event
    const event = receipt.logs.find(log => {
        try {
            return treasureHunt.interface.parseLog(log).name === "HuntCreated";
        } catch {
            return false;
        }
    });

    const huntId = treasureHunt.interface.parseLog(event).args.huntId;
    console.log("🎉 Hunt created with ID:", huntId.toString(), "\n");

    // Save hunt info for QR code generation
    const huntInfo = {
        huntId: huntId.toString(),
        secret: secret.toString(),
        gpsLat: huntConfig.gpsLat,
        gpsLon: huntConfig.gpsLon,
        latScaled,
        lonScaled,
        radiusSquared: RADIUS_SQUARED,
        locationCommitment,
        network: hre.network.name,
        contractAddress: deployment.treasureHunt,
        createdAt: new Date().toISOString(),
        hider: hider.address
    };

    const huntsDir = path.join(__dirname, "..", "hunts");
    if (!fs.existsSync(huntsDir)) {
        fs.mkdirSync(huntsDir);
    }

    const huntFile = path.join(huntsDir, `hunt_${huntId}.json`);
    fs.writeFileSync(huntFile, JSON.stringify(huntInfo, null, 2));

    console.log("💾 Hunt info saved to:", huntFile, "\n");

    // Display QR code data
    console.log("📱 QR Code Data (encode this):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const qrData = {
        huntId: huntId.toString(),
        secret: secret.toString(),
        lat: latScaled,
        lon: lonScaled,
        radius: RADIUS_SQUARED,
        network: hre.network.name,
        contract: deployment.treasureHunt
    };
    console.log(JSON.stringify(qrData, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("✅ Next steps:");
    console.log("1. Generate QR code with the data above");
    console.log("2. Print and place QR code at location:", formatCoordinates(latScaled, lonScaled));
    console.log("3. Share hunt ID", huntId.toString(), "with seekers");
    console.log("4. Wait for someone to find it!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
