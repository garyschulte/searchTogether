pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Check if GPS coordinates are within acceptable distance
 * Uses simplified Euclidean distance (good enough for ~10m radius)
 *
 * Coordinates are scaled by 1,000,000:
 * Example: 37.7749° → 37774900
 *
 * Distance calculation:
 * distSquared = (lat1 - lat2)² + (lon1 - lon2)²
 *
 * For ~10 meters at equator:
 * - 0.00009° ≈ 10m
 * - Scaled: 90 units ≈ 10m
 * - We use 100 units (~11.1m) as a nice round number
 * - radiusSquared = 100² = 10,000
 */
template DistanceCheck() {
    signal input myLat;
    signal input myLon;
    signal input targetLat;
    signal input targetLon;
    signal input maxDistSquared;

    signal output withinRange;

    // Calculate differences
    signal latDiff;
    signal lonDiff;
    latDiff <== myLat - targetLat;
    lonDiff <== myLon - targetLon;

    // Calculate distance squared (must split into quadratic constraints)
    signal latDiffSquared;
    signal lonDiffSquared;
    latDiffSquared <== latDiff * latDiff;
    lonDiffSquared <== lonDiff * lonDiff;

    signal distSquared;
    distSquared <== latDiffSquared + lonDiffSquared;

    // Check if distance is within acceptable range
    component comp = LessThan(64);  // 64-bit comparison
    comp.in[0] <== distSquared;
    comp.in[1] <== maxDistSquared;

    withinRange <== comp.out;
}

/**
 * Main treasure claim circuit
 *
 * Private inputs (finder keeps secret):
 * - secret: Value from QR code
 * - gpsLat: Finder's GPS latitude (scaled by 1M)
 * - gpsLon: Finder's GPS longitude (scaled by 1M)
 * - targetLat: Treasure GPS latitude (scaled by 1M)
 * - targetLon: Treasure GPS longitude (scaled by 1M)
 * - radiusSquared: Acceptable radius squared (100² = 10,000 for ~10m)
 * - claimerAddress: Address of the finder (Ethereum address as uint256)
 *
 * Public output:
 * - claimCommitment: Poseidon(locationCommitment, claimerAddress)
 *
 * The circuit proves:
 * 1. I know a secret that matches the QR code
 * 2. I know GPS coordinates within ~10m of treasure
 * 3. This proof is bound to my specific address
 */
template TreasureClaim() {
    // Private inputs
    signal input secret;
    signal input gpsLat;
    signal input gpsLon;
    signal input targetLat;
    signal input targetLon;
    signal input radiusSquared;
    signal input claimerAddress;

    // Public output - single commitment binding everything
    signal output claimCommitment;

    // Step 1: Compute location commitment
    // This matches what the hider computed when creating the hunt
    component locationHasher = Poseidon(3);
    locationHasher.inputs[0] <== targetLat;
    locationHasher.inputs[1] <== targetLon;
    locationHasher.inputs[2] <== radiusSquared;
    signal locationCommitment;
    locationCommitment <== locationHasher.out;

    // Step 2: Verify GPS distance is within acceptable range
    component distCheck = DistanceCheck();
    distCheck.myLat <== gpsLat;
    distCheck.myLon <== gpsLon;
    distCheck.targetLat <== targetLat;
    distCheck.targetLon <== targetLon;
    distCheck.maxDistSquared <== radiusSquared;

    // This constraint ensures GPS is within range
    distCheck.withinRange === 1;

    // Step 3: Verify secret knowledge
    // The secret proves the finder actually found the QR code
    component secretHasher = Poseidon(1);
    secretHasher.inputs[0] <== secret;
    signal secretHash;
    secretHash <== secretHasher.out;

    // Step 4: Create binding claim commitment
    // This ties the proof to a specific claimer address
    // Without this, someone could copy the proof and use it themselves
    component claimHasher = Poseidon(3);
    claimHasher.inputs[0] <== locationCommitment;
    claimHasher.inputs[1] <== secretHash;
    claimHasher.inputs[2] <== claimerAddress;

    claimCommitment <== claimHasher.out;

    // The circuit has now proven:
    // - Knowledge of secret (via secretHash)
    // - GPS within range (via distance check)
    // - Binding to specific address (via claimCommitment)
}

component main = TreasureClaim();
