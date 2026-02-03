# Testing Guide - ZK Proof Generation and Verification

This guide shows you how to test the complete ZK proof flow from the command line.

## Quick Test

### One-Command Full Test

Run the complete test suite that generates real ZK proofs:

```bash
npx hardhat run scripts/testProofFlow.js --network hardhat
```

This will:
1. ✅ Generate a random secret and GPS coordinates
2. ✅ Compute Poseidon hashes and commitments
3. ✅ Generate ZK proof (~10-30 seconds)
4. ✅ Verify proof off-chain
5. ✅ Test negative cases (wrong address, wrong GPS)
6. ✅ Deploy contracts
7. ✅ Verify proof on-chain
8. ✅ Complete full treasure hunt flow
9. ✅ Withdraw prize

**Expected Output:**
```
🧪 Testing ZK Proof Generation and Verification
============================================================

📋 STEP 1: Setting up test data...
Secret generated: 123456789...
Treasure location: 37.774900° N, 122.419400° W
Finder location:   37.774950° N, 122.419450° W
Distance:          7.84 meters
Within radius?     ✅ Yes

🔨 STEP 2: Computing commitments...
Secret hash:           12345...
Location commitment:   67890...
Claim commitment:      98765...

⚡ STEP 3: Generating ZK proof...
✅ Proof generated in 15.23 seconds!

🔍 STEP 4: Verifying proof off-chain...
✅ Proof verified successfully off-chain!

🧪 STEP 5: Testing negative cases...
Test 1: Proof with wrong claimer address
  ✅ Different commitment generated (as expected)
Test 2: GPS location too far away
  ✅ Proof generation failed (as expected)

📜 STEP 6: Testing on-chain verification...
✅ Verifier deployed to: 0x...
✅ TreasureHunt deployed to: 0x...
✅ Proof verified successfully on-chain!

🏴‍☠️ STEP 7: Complete treasure hunt flow...
✅ Hunt created (ID: 0)
✅ Claim submitted and verified on-chain!
✅ Withdrawal successful!

🎉 ALL TESTS PASSED!
```

---

## Step-by-Step Manual Testing

### Step 1: Generate a Witness

Test the circuit with sample inputs:

```bash
cd circuits

# Create test input
cat > test_input.json << 'EOF'
{
  "secret": "123456789",
  "gpsLat": "37774950",
  "gpsLon": "-122419450",
  "targetLat": "37774900",
  "targetLon": "-122419400",
  "radiusSquared": "10000",
  "claimerAddress": "1234567890123456789012345678901234567890"
}
EOF

# Generate witness
node treasure_claim_js/generate_witness.js \
  treasure_claim_js/treasure_claim.wasm \
  test_input.json \
  witness.wtns

echo "✅ Witness generated successfully!"
```

**What this tests**: Circuit logic is correct and can generate a witness

---

### Step 2: Generate a Proof

Generate a ZK proof from the witness:

```bash
# Still in circuits/ directory
npx snarkjs groth16 prove \
  circuit_final.zkey \
  witness.wtns \
  proof.json \
  public.json

echo "✅ Proof generated!"
cat public.json
```

**Expected output**: `public.json` contains the claim commitment

**What this tests**: Proving key works and can generate proofs

---

### Step 3: Verify Proof Off-Chain

Verify the proof using the verification key:

```bash
# Still in circuits/ directory
npx snarkjs groth16 verify \
  verification_key.json \
  public.json \
  proof.json

# Should output: [INFO]  snarkJS: OK!
```

**What this tests**: Proof is cryptographically valid

---

### Step 4: Test On-Chain Verification

Test the Solidity verifier contract:

```bash
cd ..

# Create a simple test script
cat > scripts/testVerifier.js << 'EOF'
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("📜 Testing Solidity Verifier\n");

    // Deploy Verifier
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    console.log("✅ Verifier deployed");

    // Load proof
    const proof = JSON.parse(fs.readFileSync("circuits/proof.json"));
    const publicSignals = JSON.parse(fs.readFileSync("circuits/public.json"));

    // Format for Solidity
    const pA = [proof.pi_a[0], proof.pi_a[1]];
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const pC = [proof.pi_c[0], proof.pi_c[1]];

    // Verify
    const result = await verifier.verifyProof(pA, pB, pC, [publicSignals[0]]);

    if (result) {
        console.log("✅ Proof verified on-chain!");
    } else {
        console.error("❌ Verification failed!");
        process.exit(1);
    }
}

main().catch(console.error);
EOF

npx hardhat run scripts/testVerifier.js --network hardhat
```

**What this tests**: Solidity verifier contract works correctly

---

## Testing Specific Scenarios

### Test 1: Valid Proof Within Radius

```bash
# Use the testProofFlow script with default values
npx hardhat run scripts/testProofFlow.js --network hardhat
```

### Test 2: GPS Too Far (Should Fail)

Create a test with GPS outside 10m radius:

```bash
cd circuits

cat > test_far.json << 'EOF'
{
  "secret": "123456789",
  "gpsLat": "37775500",
  "gpsLon": "-122420000",
  "targetLat": "37774900",
  "targetLon": "-122419400",
  "radiusSquared": "10000",
  "claimerAddress": "1234567890123456789012345678901234567890"
}
EOF

# Try to generate witness - should fail
node treasure_claim_js/generate_witness.js \
  treasure_claim_js/treasure_claim.wasm \
  test_far.json \
  witness_far.wtns

# Expected: Error - constraint not satisfied
```

### Test 3: Different Claimer Address

```bash
# Generate proof with address A
cat > test_alice.json << 'EOF'
{
  "secret": "123456789",
  "gpsLat": "37774950",
  "gpsLon": "-122419450",
  "targetLat": "37774900",
  "targetLon": "-122419400",
  "radiusSquared": "10000",
  "claimerAddress": "1111111111111111111111111111111111111111"
}
EOF

node treasure_claim_js/generate_witness.js \
  treasure_claim_js/treasure_claim.wasm \
  test_alice.json \
  witness_alice.wtns

npx snarkjs groth16 prove \
  circuit_final.zkey \
  witness_alice.wtns \
  proof_alice.json \
  public_alice.json

# Generate proof with address B
cat > test_bob.json << 'EOF'
{
  "secret": "123456789",
  "gpsLat": "37774950",
  "gpsLon": "-122419450",
  "targetLat": "37774900",
  "targetLon": "-122419400",
  "radiusSquared": "10000",
  "claimerAddress": "2222222222222222222222222222222222222222"
}
EOF

node treasure_claim_js/generate_witness.js \
  treasure_claim_js/treasure_claim.wasm \
  test_bob.json \
  witness_bob.wtns

npx snarkjs groth16 prove \
  circuit_final.zkey \
  witness_bob.wtns \
  proof_bob.json \
  public_bob.json

# Compare commitments - should be different!
echo "Alice commitment:"
cat public_alice.json
echo "Bob commitment:"
cat public_bob.json

# They're different - Bob can't use Alice's proof!
```

---

## Performance Testing

### Measure Proof Generation Time

```bash
cd circuits

time node treasure_claim_js/generate_witness.js \
  treasure_claim_js/treasure_claim.wasm \
  test_input.json \
  witness.wtns

time npx snarkjs groth16 prove \
  circuit_final.zkey \
  witness.wtns \
  proof.json \
  public.json
```

**Expected**:
- Witness generation: < 1 second
- Proof generation: 10-30 seconds (depends on CPU)

### Measure Gas Costs

```bash
REPORT_GAS=true npx hardhat test
```

**Expected gas costs**:
- Deploy Verifier: ~1,000,000 gas
- Deploy TreasureHunt: ~1,500,000 gas
- Claim (verify proof): ~280,000 gas

---

## Debugging

### Check Circuit Info

```bash
cd circuits
npx snarkjs r1cs info treasure_claim.r1cs
```

Shows:
- Number of constraints
- Number of private inputs
- Number of public outputs

### Print Constraints

```bash
npx snarkjs r1cs print treasure_claim.r1cs treasure_claim.sym
```

Shows all constraints (useful for debugging circuit logic)

### Export Witness as JSON

```bash
npx snarkjs wtns export json witness.wtns witness.json
cat witness.json | jq '.[0:10]'  # Show first 10 signals
```

Shows all intermediate signal values (useful for debugging)

### Verify Circuit Constraints

```bash
npx snarkjs wtns check treasure_claim.r1cs witness.wtns
```

Verifies the witness satisfies all constraints

---

## Common Issues

### Issue: "snarkjs: command not found"

```bash
npm install
# snarkjs is in node_modules, use npx
```

### Issue: "Circuit files not found"

```bash
cd circuits
./compile.sh
./setup.sh
```

### Issue: "Constraint not satisfied"

Your input values don't satisfy the circuit logic. Check:
- GPS distance is within radius
- All values are scaled correctly (multiply by 1,000,000)
- radiusSquared = 10,000 for ~10m

### Issue: Proof generation takes forever

Normal: 10-30 seconds on modern hardware
Slow: >1 minute indicates:
- Low RAM (need 2GB+)
- Old CPU
- Other processes using resources

### Issue: Out of memory

Proof generation needs ~2GB RAM. Close other applications.

---

## Continuous Testing

### Watch Mode

For development, auto-run tests when files change:

```bash
npx hardhat watch test
```

### Test Specific Functions

```bash
# Test only hunt creation
npx hardhat test --grep "Hunt Creation"

# Test only claiming
npx hardhat test --grep "Claiming"

# Test only withdrawals
npx hardhat test --grep "Withdrawals"
```

---

## Integration Testing

### Full End-to-End Test

```bash
# Start local blockchain
npx hardhat node &

# Run full flow
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/createHunt.js --network localhost
npx hardhat run scripts/claimHunt.js --network localhost
npx hardhat run scripts/withdraw.js --network localhost

# Kill blockchain
killall hardhat
```

---

## Summary

**Quick Commands:**

```bash
# Full automated test (recommended)
npx hardhat run scripts/testProofFlow.js --network hardhat

# Unit tests
npx hardhat test

# Manual proof generation
cd circuits
node treasure_claim_js/generate_witness.js treasure_claim_js/treasure_claim.wasm test_input.json witness.wtns
npx snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json
npx snarkjs groth16 verify verification_key.json public.json proof.json

# Check gas costs
REPORT_GAS=true npx hardhat test
```

**Expected Results:**
- ✅ All tests pass
- ✅ Proof generates in 10-30 seconds
- ✅ Proof verifies successfully
- ✅ Gas costs reasonable (~280k for claim)

---

**Next**: Deploy to testnet and test with real mobile GPS!
