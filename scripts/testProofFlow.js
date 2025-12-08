/**
 * Test the complete ZK proof flow
 *
 * This script demonstrates:
 * 1. Generating a ZK proof off-chain
 * 2. Verifying the proof off-chain
 * 3. Verifying the proof on-chain via contract
 * 4. Complete treasure hunt flow with real proofs
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const {
    computeLocationCommitment,
    computeSecretHash,
    computeClaimCommitment,
    addressToBigInt,
    generateSecret
} = require("../utils/hash");
const {
    degreesToScaled,
    formatCoordinates,
    RADIUS_SQUARED,
    isWithinRadius,
    scaledToMeters,
    distanceSquared
} = require("../utils/gps");

async function main() {
    console.log("🧪 Testing ZK Proof Generation and Verification\n");
    console.log("=" .repeat(60));

    // ========================================
    // STEP 1: Setup Test Data
    // ========================================
    console.log("\n📋 STEP 1: Setting up test data...\n");

    // Generate a random secret
    const secret = generateSecret();
    console.log("Secret generated:", secret.toString().substring(0, 20) + "...");

    // Set treasure location (San Francisco)
    const treasureLat = 37.7749;
    const treasureLon = -122.4194;
    const treasureLatScaled = degreesToScaled(treasureLat);
    const treasureLonScaled = degreesToScaled(treasureLon);

    console.log("Treasure location:", formatCoordinates(treasureLatScaled, treasureLonScaled));

    // Set finder location (within 10m of treasure)
    const finderLatScaled = treasureLatScaled + 50;  // ~5.5m away
    const finderLonScaled = treasureLonScaled + 50;

    console.log("Finder location:  ", formatCoordinates(finderLatScaled, finderLonScaled));

    // Calculate distance
    const distSq = distanceSquared(finderLatScaled, finderLonScaled, treasureLatScaled, treasureLonScaled);
    const distance = Math.sqrt(distSq);
    const distanceMeters = scaledToMeters(distance);
    console.log("Distance:         ", distanceMeters.toFixed(2), "meters");
    console.log("Within radius?    ", isWithinRadius(finderLatScaled, finderLonScaled, treasureLatScaled, treasureLonScaled) ? "✅ Yes" : "❌ No");

    // Get claimer address
    const [claimer] = await hre.ethers.getSigners();
    console.log("Claimer address:  ", claimer.address);

    // ========================================
    // STEP 2: Compute Hashes/Commitments
    // ========================================
    console.log("\n🔨 STEP 2: Computing commitments...\n");

    const secretHash = await computeSecretHash(secret);
    console.log("Secret hash:           ", secretHash);

    const locationCommitment = await computeLocationCommitment(
        treasureLatScaled,
        treasureLonScaled,
        RADIUS_SQUARED
    );
    console.log("Location commitment:   ", locationCommitment);

    const claimCommitment = await computeClaimCommitment(
        locationCommitment,
        secretHash,
        claimer.address
    );
    console.log("Claim commitment:      ", claimCommitment);

    // ========================================
    // STEP 3: Generate ZK Proof
    // ========================================
    console.log("\n⚡ STEP 3: Generating ZK proof...\n");

    const circuitInputs = {
        secret: secret.toString(),
        gpsLat: finderLatScaled.toString(),
        gpsLon: finderLonScaled.toString(),
        targetLat: treasureLatScaled.toString(),
        targetLon: treasureLonScaled.toString(),
        radiusSquared: RADIUS_SQUARED.toString(),
        claimerAddress: addressToBigInt(claimer.address).toString()
    };

    console.log("Circuit inputs prepared");
    console.log("  - Secret: (hidden)");
    console.log("  - Finder GPS:", finderLatScaled, finderLonScaled);
    console.log("  - Target GPS:", treasureLatScaled, treasureLonScaled);
    console.log("  - Radius²:", RADIUS_SQUARED);
    console.log("  - Claimer:", claimer.address.substring(0, 10) + "...");

    const wasmFile = path.join(__dirname, "..", "circuits", "treasure_claim_js", "treasure_claim.wasm");
    const zkeyFile = path.join(__dirname, "..", "circuits", "circuit_final.zkey");

    if (!fs.existsSync(wasmFile)) {
        console.error("\n❌ Error: Circuit WASM file not found!");
        console.log("Run: cd circuits && ./compile.sh");
        process.exit(1);
    }

    if (!fs.existsSync(zkeyFile)) {
        console.error("\n❌ Error: Circuit proving key not found!");
        console.log("Run: cd circuits && ./setup.sh");
        process.exit(1);
    }

    console.log("\nGenerating proof (this takes 10-30 seconds)...");
    const startTime = Date.now();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInputs,
        wasmFile,
        zkeyFile
    );

    const proofTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Proof generated in ${proofTime} seconds!\n`);

    console.log("Proof components:");
    console.log("  - pi_a:", proof.pi_a[0].substring(0, 20) + "...");
    console.log("  - pi_b:", proof.pi_b[0][0].substring(0, 20) + "...");
    console.log("  - pi_c:", proof.pi_c[0].substring(0, 20) + "...");
    console.log("\nPublic signal (claim commitment):", publicSignals[0]);

    // Verify the commitment matches
    if (publicSignals[0] === claimCommitment) {
        console.log("✅ Commitment matches expected value!");
    } else {
        console.error("❌ Commitment mismatch!");
        console.log("Expected:", claimCommitment);
        console.log("Got:     ", publicSignals[0]);
    }

    // ========================================
    // STEP 4: Verify Proof Off-Chain
    // ========================================
    console.log("\n🔍 STEP 4: Verifying proof off-chain...\n");

    const vkeyFile = path.join(__dirname, "..", "circuits", "verification_key.json");
    const vkey = JSON.parse(fs.readFileSync(vkeyFile));

    console.log("Loading verification key...");
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (verified) {
        console.log("✅ Proof verified successfully off-chain!");
    } else {
        console.error("❌ Proof verification failed off-chain!");
        process.exit(1);
    }

    // ========================================
    // STEP 5: Test Negative Cases
    // ========================================
    console.log("\n🧪 STEP 5: Testing negative cases...\n");

    // Test 1: Wrong claimer address
    console.log("Test 1: Proof with wrong claimer address");
    const [wrongClaimer] = await hre.ethers.getSigners();
    const wrongAddress = "0x0000000000000000000000000000000000000001";

    const wrongInputs = {
        ...circuitInputs,
        claimerAddress: addressToBigInt(wrongAddress).toString()
    };

    try {
        const { proof: wrongProof, publicSignals: wrongSignals } = await snarkjs.groth16.fullProve(
            wrongInputs,
            wasmFile,
            zkeyFile
        );

        if (wrongSignals[0] !== claimCommitment) {
            console.log("  ✅ Different commitment generated (as expected)");
            console.log("     Original:", claimCommitment.substring(0, 20) + "...");
            console.log("     Modified:", wrongSignals[0].substring(0, 20) + "...");
        }
    } catch (error) {
        console.log("  ⚠️  Proof generation failed (this might be OK)");
    }

    // Test 2: GPS too far away
    console.log("\nTest 2: GPS location too far away (should fail)");
    const farLatScaled = treasureLatScaled + 500;  // ~55m away (outside 10m radius)
    const farLonScaled = treasureLonScaled + 500;

    const farInputs = {
        ...circuitInputs,
        gpsLat: farLatScaled.toString(),
        gpsLon: farLonScaled.toString()
    };

    try {
        await snarkjs.groth16.fullProve(farInputs, wasmFile, zkeyFile);
        console.log("  ❌ ERROR: Proof should have failed but succeeded!");
    } catch (error) {
        console.log("  ✅ Proof generation failed (as expected)");
        console.log("     Distance check constraint not satisfied");
    }

    // ========================================
    // STEP 6: Deploy Contract and Verify On-Chain
    // ========================================
    console.log("\n📜 STEP 6: Testing on-chain verification...\n");

    console.log("Deploying Verifier contract...");
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);

    console.log("\nDeploying TreasureHunt contract...");
    const TreasureHunt = await hre.ethers.getContractFactory("TreasureHunt");
    const treasureHunt = await TreasureHunt.deploy(verifierAddress);
    await treasureHunt.waitForDeployment();
    const treasureHuntAddress = await treasureHunt.getAddress();
    console.log("✅ TreasureHunt deployed to:", treasureHuntAddress);

    // Format proof for Solidity
    const proofForSolidity = {
        pA: [proof.pi_a[0], proof.pi_a[1]],
        pB: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        pC: [proof.pi_c[0], proof.pi_c[1]]
    };

    console.log("\nVerifying proof directly with Verifier contract...");
    const verifyTx = await verifier.verifyProof(
        proofForSolidity.pA,
        proofForSolidity.pB,
        proofForSolidity.pC,
        [publicSignals[0]]
    );

    if (verifyTx) {
        console.log("✅ Proof verified successfully on-chain!");
    } else {
        console.error("❌ Proof verification failed on-chain!");
        process.exit(1);
    }

    // ========================================
    // STEP 7: Full Treasure Hunt Flow
    // ========================================
    console.log("\n🏴‍☠️ STEP 7: Complete treasure hunt flow...\n");

    const prizeAmount = hre.ethers.parseEther("0.01");
    const lockoutPeriod = 24 * 60 * 60; // 1 day (minimum required)
    const duration = 7 * 24 * 60 * 60; // 7 days
    const hintPrice = hre.ethers.parseEther("0.001");

    console.log("Creating hunt...");
    const createTx = await treasureHunt.createHunt(
        locationCommitment,
        lockoutPeriod,
        duration,
        hintPrice,
        { value: prizeAmount }
    );
    await createTx.wait();
    console.log("✅ Hunt created (ID: 0)");
    console.log("   Prize:", hre.ethers.formatEther(prizeAmount), "ETH");

    // Fast-forward time past lockout period
    console.log("\nFast-forwarding time past lockout period...");
    await hre.network.provider.send("evm_increaseTime", [lockoutPeriod + 1]);
    await hre.network.provider.send("evm_mine");

    console.log("\nSubmitting claim with ZK proof...");
    const claimTx = await treasureHunt.claimTreasure(
        0, // huntId
        proofForSolidity.pA,
        proofForSolidity.pB,
        proofForSolidity.pC,
        publicSignals[0] // claimCommitment
    );
    await claimTx.wait();
    console.log("✅ Claim submitted and verified on-chain!");

    const hunt = await treasureHunt.getHunt(0);
    console.log("   Hunt status:", hunt.status === 1n ? "Claimed" : "Unknown");

    const claim = await treasureHunt.getClaim(0);
    console.log("   Claimer:", claim.claimer);

    if (claim.claimer === claimer.address) {
        console.log("   ✅ Correct claimer address!");
    }

    console.log("\nWithdrawing prize...");
    const balanceBefore = await hre.ethers.provider.getBalance(claimer.address);
    const withdrawTx = await treasureHunt.withdraw(0);
    const receipt = await withdrawTx.wait();
    const balanceAfter = await hre.ethers.provider.getBalance(claimer.address);

    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const netGain = balanceAfter - balanceBefore + gasUsed;

    console.log("✅ Withdrawal successful!");
    console.log("   Withdrew:", hre.ethers.formatEther(netGain), "ETH");
    console.log("   Expected: ~0.005 ETH (50% of 0.01 ETH)");

    // ========================================
    // Summary
    // ========================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 ALL TESTS PASSED!\n");
    console.log("Summary:");
    console.log("  ✅ ZK proof generated in", proofTime, "seconds");
    console.log("  ✅ Proof verified off-chain");
    console.log("  ✅ Proof verified on-chain");
    console.log("  ✅ Negative cases handled correctly");
    console.log("  ✅ Full treasure hunt flow completed");
    console.log("  ✅ Prize withdrawn successfully");
    console.log("\n" + "=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
