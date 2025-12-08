/**
 * Example script: Claim a treasure hunt
 *
 * This demonstrates how a finder claims a treasure:
 * 1. Scan QR code to get secret and location
 * 2. Get current GPS coordinates
 * 3. Generate ZK proof
 * 4. Submit claim to contract
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { computeLocationCommitment, computeSecretHash, computeClaimCommitment, addressToBigInt } = require("../utils/hash");
const { isWithinRadius, formatCoordinates, scaledToMeters, distanceSquared } = require("../utils/gps");
const snarkjs = require("snarkjs");

async function main() {
    console.log("🔍 Claiming treasure hunt...\n");

    // In a real app, this would come from scanning QR code
    const huntId = process.argv[2] || "0";
    const qrData = JSON.parse(process.argv[3] || fs.readFileSync(path.join(__dirname, "..", "hunts", `hunt_${huntId}.json`)));

    console.log("📱 QR Code Data:");
    console.log("Hunt ID:", qrData.huntId);
    console.log("Secret:", qrData.secret);
    console.log("Target location:", formatCoordinates(qrData.latScaled, qrData.lonScaled));
    console.log();

    // In a real app, get GPS from device
    // For demo, simulate being near the location
    const finderGPS = {
        lat: qrData.latScaled + 50,  // Within 10m
        lon: qrData.lonScaled + 50
    };

    console.log("📍 Finder GPS:", formatCoordinates(finderGPS.lat, finderGPS.lon));

    // Check if within radius
    const distSq = distanceSquared(finderGPS.lat, finderGPS.lon, qrData.latScaled, qrData.lonScaled);
    const distance = Math.sqrt(distSq);
    const distanceMeters = scaledToMeters(distance);

    console.log("📏 Distance to treasure:", distanceMeters.toFixed(2), "meters");

    if (!isWithinRadius(finderGPS.lat, finderGPS.lon, qrData.latScaled, qrData.lonScaled)) {
        console.error("❌ Too far from treasure location!");
        console.log("Required: within ~10 meters");
        process.exit(1);
    }

    console.log("✅ Within acceptable radius!\n");

    // Get claimer account
    const [claimer] = await hre.ethers.getSigners();
    console.log("👤 Claimer address:", claimer.address, "\n");

    // Prepare circuit inputs
    console.log("🔧 Preparing ZK proof inputs...");
    const circuitInputs = {
        secret: qrData.secret,
        gpsLat: finderGPS.lat.toString(),
        gpsLon: finderGPS.lon.toString(),
        targetLat: qrData.latScaled.toString(),
        targetLon: qrData.lonScaled.toString(),
        radiusSquared: qrData.radiusSquared.toString(),
        claimerAddress: addressToBigInt(claimer.address).toString()
    };

    // Generate ZK proof
    console.log("⚡ Generating ZK proof (this may take a minute)...");

    const wasmFile = path.join(__dirname, "..", "circuits", "treasure_claim_js", "treasure_claim.wasm");
    const zkeyFile = path.join(__dirname, "..", "circuits", "circuit_final.zkey");

    if (!fs.existsSync(wasmFile) || !fs.existsSync(zkeyFile)) {
        console.error("❌ Circuit files not found!");
        console.log("Run the following commands:");
        console.log("  cd circuits");
        console.log("  ./compile.sh");
        console.log("  ./setup.sh");
        process.exit(1);
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInputs,
        wasmFile,
        zkeyFile
    );

    console.log("✅ Proof generated!");
    console.log("Public signal (claim commitment):", publicSignals[0], "\n");

    // Verify proof locally first
    console.log("🔍 Verifying proof locally...");
    const vkeyFile = path.join(__dirname, "..", "circuits", "verification_key.json");
    const vkey = JSON.parse(fs.readFileSync(vkeyFile));

    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    if (!verified) {
        console.error("❌ Proof verification failed!");
        process.exit(1);
    }
    console.log("✅ Local verification passed!\n");

    // Load deployment
    const deploymentFile = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
    const deployment = JSON.parse(fs.readFileSync(deploymentFile));

    // Submit claim to contract
    console.log("📤 Submitting claim to blockchain...");
    const TreasureHunt = await hre.ethers.getContractFactory("TreasureHunt");
    const treasureHunt = TreasureHunt.attach(deployment.treasureHunt);

    // Format proof for Solidity
    const proofForSolidity = {
        pA: [proof.pi_a[0], proof.pi_a[1]],
        pB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        pC: [proof.pi_c[0], proof.pi_c[1]]
    };

    const claimCommitment = publicSignals[0];

    const tx = await treasureHunt.claimTreasure(
        huntId,
        proofForSolidity.pA,
        proofForSolidity.pB,
        proofForSolidity.pC,
        claimCommitment
    );

    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!\n");

    console.log("🎉 Treasure claimed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Hunt ID:", huntId);
    console.log("Claimer:", claimer.address);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("💰 Next steps:");
    console.log("1. Wait 24 hours for first withdrawal window");
    console.log("2. Call withdraw() to get 50% of pot");
    console.log("3. Repeat daily until pot is empty");
    console.log("\nRun: npx hardhat run scripts/withdraw.js --network", hre.network.name);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
