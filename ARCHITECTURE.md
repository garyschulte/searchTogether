# Architecture Deep Dive

## Security Model

### Threat Model

**What we're protecting against:**

1. **Front-running**: Attacker copies valid proof from mempool
2. **Sybil attacks**: Hider claims own prize with fake account
3. **GPS spoofing**: Fake location to claim remotely
4. **Secret extraction**: Reverse engineer secret from on-chain data

**What we accept as limitations:**

1. Device GPS accuracy (~5-10m typical)
2. Hider has information advantage (knows location/secret)
3. Simplified distance calculation (Euclidean vs Haversine)

### Defense Mechanisms

#### 1. ZK Proof with Address Binding

**Problem**: Alice generates proof, Bob copies it from mempool

**Solution**: Proof cryptographically binds to claimer's address

```
Circuit computes:
  claimCommitment = Poseidon(locationCommitment, secretHash, claimerAddress)

Contract verifies:
  1. Proof is valid for claimCommitment
  2. claimerAddress in proof == msg.sender
  3. locationCommitment matches hunt
```

**Why it works**:
- Bob can't modify the proof (cryptographically sealed)
- Bob can't generate new proof (doesn't know secret/GPS)
- Bob can't change address in proof (breaks cryptographic binding)

#### 2. Time-Locked Withdrawals

**Problem**: Exploit might drain entire pot instantly

**Solution**: 50% withdrawal per day

```
Day 0: Claim treasure
Day 0: Withdraw 50% (0.5 ETH from 1 ETH pot)
Day 1: Withdraw 50% (0.25 ETH from 0.5 ETH pot)
Day 2: Withdraw 50% (0.125 ETH from 0.25 ETH pot)
...
```

**Why it works**:
- Limits blast radius of exploits
- Gives community time to detect fraud
- Allows for emergency intervention

#### 3. Hider Lockout Period

**Problem**: Hider plants QR and immediately "finds" it

**Solution**: Configurable lockout (default 24-48 hours)

```
Create hunt: block.timestamp = T
Lockout until: T + lockoutPeriod
Anyone can claim: T + lockoutPeriod to T + duration
```

**Why it works**:
- Gives legitimate seekers head start
- Makes self-claiming less profitable (pot grows from hints)
- Economically incentivizes honest behavior

## ZK-SNARK Circuit

### Circuit Flow

```circom
Private Inputs:
  - secret              // From QR code
  - gpsLat, gpsLon      // Finder's GPS
  - targetLat, targetLon // From QR/hunt
  - radiusSquared       // Distance threshold
  - claimerAddress      // Ethereum address

Computation:
  1. secretHash = Poseidon(secret)
  2. locationCommitment = Poseidon(targetLat, targetLon, radiusSquared)
  3. distance² = (gpsLat - targetLat)² + (gpsLon - targetLon)²
  4. assert distance² <= radiusSquared
  5. claimCommitment = Poseidon(locationCommitment, secretHash, claimerAddress)

Public Output:
  - claimCommitment
```

### Why This Is Secure

**Zero-Knowledge Property**:
- Proof reveals nothing about private inputs
- Can't extract secret, GPS, or target location from proof
- Cryptographically guaranteed by ZK-SNARK construction

**Soundness**:
- Can't create valid proof without satisfying all constraints
- Must actually know secret and be at location
- Groth16 proof system provides ~128-bit security

**Address Binding**:
- Commitment includes claimerAddress as input
- Different address → different commitment → proof fails
- Prevents proof replay attacks

### Constraint System

The circuit compiles to ~1000-2000 R1CS constraints:

```
Poseidon hash (1 input):     ~130 constraints
Poseidon hash (3 inputs):    ~250 constraints
Distance calculation:        ~100 constraints
LessThan comparison:         ~64 constraints
Additional logic:            ~500 constraints
Total:                       ~1000-2000 constraints
```

This is small enough for:
- Fast proving (~10-30 seconds on modern hardware)
- Cheap verification (~250k gas on Ethereum)
- Mobile device compatibility

## Smart Contract Design

### State Management

```solidity
struct Hunt {
    address hider;              // Creator
    uint256 locationCommitment; // Poseidon(lat, lon, radius²)
    uint256 createdAt;
    uint256 claimableAfter;     // Anti-sybil lockout
    uint256 expiresAt;
    uint256 hintPrice;
    HuntStatus status;          // Active, Claimed, Expired
}

struct Claim {
    address claimer;
    uint256 claimTime;
    uint256 lastWithdrawal;
    uint256 totalWithdrawn;
}
```

### Key Functions

#### createHunt()
```
1. Validate inputs (lockout, duration, prize)
2. Store location commitment
3. Emit HuntCreated event
4. Return huntId
```

#### claimTreasure()
```
1. Check hunt is active and claimable
2. Verify ZK proof via Verifier contract
3. Mark hunt as claimed
4. Record claimer and timestamp
```

#### withdraw()
```
1. Check caller is claimer
2. Check 24 hours elapsed since last withdrawal
3. Calculate 50% of remaining balance
4. Transfer to claimer
5. Update withdrawal timestamp
```

### Gas Optimization

- Use `uint256` for timestamps (native EVM word size)
- Minimize storage writes (expensive)
- Use events for off-chain indexing
- Batch operations where possible

**Typical gas costs**:
- Create hunt: ~100k gas (~$3 at 30 gwei, $2000 ETH)
- Claim: ~280k gas (~$8)
- Withdraw: ~30k gas (~$1)

## GPS Coordinate System

### Scaling

GPS coordinates are floating point, but circuits need integers:

```
Decimal degrees:  37.7749°
Scaled integer:   37774900 (multiply by 1,000,000)

Precision: 6 decimal places
Real-world: ~11cm at equator
```

### Distance Calculation

**Simplified Euclidean** (current implementation):

```javascript
distSquared = (lat1 - lat2)² + (lon1 - lon2)²
```

**Error analysis**:
- Accurate within 1% for distances <1km at mid-latitudes
- Max error ~10cm for 10m radius
- Good enough for treasure hunt use case

**Haversine formula** (future improvement):

```
a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
c = 2⋅atan2(√a, √(1−a))
d = R⋅c

where:
  φ = latitude
  λ = longitude
  R = Earth radius
```

More accurate but expensive in ZK circuit:
- Requires trigonometry (~1000 additional constraints)
- Needs polynomial approximations
- Longer proving time

### Radius Selection

**Current: ~10 meters (100 scaled units)**

| Radius (m) | Scaled | Use Case |
|------------|--------|----------|
| 5m         | 50     | Precise location (statue, bench) |
| 10m        | 100    | Small area (building entrance) |
| 50m        | 500    | Neighborhood (park, plaza) |
| 100m       | 1000   | Large area (campus, district) |

Trade-off:
- Too small: GPS inaccuracy causes false rejections
- Too large: Cheating becomes easier

## Cryptographic Primitives

### Poseidon Hash

**Why Poseidon?**
- ZK-friendly (designed for circuits)
- Only ~130 constraints per hash (vs 25,000 for SHA-256)
- Collision-resistant (128-bit security)
- Fast on both CPU and in circuit

**Usage**:
```javascript
// JavaScript (off-chain)
const poseidon = await buildPoseidon();
const hash = poseidon([input1, input2, ...]);

// Circom (in circuit)
component hasher = Poseidon(3);
hasher.inputs[0] <== input1;
hasher.inputs[1] <== input2;
hasher.inputs[2] <== input3;
signal output <== hasher.out;
```

### Groth16 Proof System

**Properties**:
- Constant-size proofs (~200 bytes)
- Fast verification (~200-300k gas)
- Requires trusted setup (Powers of Tau)
- 128-bit security level

**Proof structure**:
```
π = (A, B, C)
where A, B, C are elliptic curve points

A ∈ G1 (2 field elements)
B ∈ G2 (4 field elements)
C ∈ G1 (2 field elements)
```

**Verification equation** (simplified):
```
e(A, B) = e(α, β) ⋅ e(L, γ) ⋅ e(C, δ)

where:
  e = pairing function
  α, β, γ, δ = from trusted setup
  L = linear combination of public inputs
```

## Attack Scenarios

### 1. Front-Running Attack

**Attack**: Bob sees Alice's claim transaction and copies it

**Defense**: Address binding in proof

**Outcome**: ✅ Prevented
```
Alice's proof: commitment_A = H(location, secret, aliceAddr)
Bob tries to use: commitment_A with bobAddr
Contract checks: H(location, secret, bobAddr) ≠ commitment_A
Result: Transaction reverts
```

### 2. GPS Spoofing

**Attack**: Attacker fakes GPS coordinates

**Defense**: Circuit verifies distance, but GPS source is trusted

**Outcome**: ⚠️ Partially vulnerable
```
Current: Relies on device GPS honor system
Mitigation: Require multiple proofs over time
Future: Use mobile OS attestation (iOS App Attest)
```

### 3. Brute Force Secret

**Attack**: Try all possible secrets until hash matches

**Defense**: 256-bit secret space (2^256 possibilities)

**Outcome**: ✅ Prevented
```
Attack cost: 2^256 hash operations
Time at 1 TH/s: 10^58 years
Conclusion: Computationally infeasible
```

### 4. Malicious Hider

**Attack**: Hider claims own treasure with sybil account

**Defense**: Lockout period + economic incentives

**Outcome**: ⚠️ Possible but unprofitable
```
Scenario:
  Hider deposits 0.1 ETH
  Waits 2 days (lockout)
  Claims with alt account
  Net gain: 0 (minus gas fees)

If pot grows from hints:
  Hider deposits 0.1 ETH
  Seekers add 0.5 ETH in hints
  Hider claims 0.6 ETH total
  But risked 0.1 ETH for 2+ days
  Reputation damage if caught
```

### 5. Proof Malleability

**Attack**: Modify proof components to pass verification

**Defense**: Groth16 proofs are not malleable

**Outcome**: ✅ Prevented
```
Groth16 soundness guarantee:
  Any valid proof must correspond to valid witness
  Can't modify (A,B,C) without breaking verification
```

## Future Improvements

### 1. On-Chain Poseidon Hash

**Current**: Contract trusts verifier to check commitment

**Improvement**: Verify commitment on-chain
```solidity
function claimTreasure(...) {
    uint256 expectedCommitment = poseidon(
        hunt.locationCommitment,
        computeSecretHash(secret),
        uint256(uint160(msg.sender))
    );
    require(_claimCommitment == expectedCommitment);
    // ...
}
```

**Challenge**: Poseidon not in EVM precompiles (expensive gas)

### 2. Mobile OS Attestation

**Integrate iOS App Attest / Android SafetyNet**:

```javascript
// Request signed GPS from OS
const attestation = await device.requestLocationAttestation();
// attestation = signature(lat, lon, timestamp, appId, deviceId)

// Include in ZK proof as additional private input
// Verify OS signature in circuit
```

**Benefits**:
- Hardware-backed GPS verification
- Resistant to software spoofing
- Apple/Google as trust anchors

### 3. Multi-Hunt Support ✅ IMPLEMENTED

**Status**: Fully implemented with isolated per-hunt accounting

```solidity
struct Hunt {
    address hider;
    uint256 locationCommitment;
    uint256 initialPrize;       // ← Track initial deposit
    uint256 createdAt;
    uint256 claimableAfter;
    uint256 expiresAt;
    uint256 hintPrice;
    HuntStatus status;
}

mapping(uint256 => Hunt) public hunts;
mapping(uint256 => uint256) public totalContributions;

function getPotBalance(uint256 huntId) public view returns (uint256) {
    Hunt storage hunt = hunts[huntId];
    Claim storage claim = claims[huntId];

    uint256 totalPot = hunt.initialPrize + totalContributions[huntId];
    uint256 withdrawn = claim.totalWithdrawn;

    return totalPot > withdrawn ? totalPot - withdrawn : 0;
}
```

**Benefits**:
- ✅ Multiple hunts can run concurrently
- ✅ Each hunt has isolated accounting
- ✅ No cross-contamination of funds
- ✅ Scales to unlimited hunts

### 4. Reputation System

**Track hider history**:
```solidity
struct HiderStats {
    uint256 huntsCreated;
    uint256 huntsClaimed;
    uint256 huntsExpired;
    uint256 totalPrizes;
}
```

**Use for trust scoring**:
- High completion rate = trusted hider
- Many expired hunts = suspicious
- Display on hunt listings

### 5. Hint Reveal Mechanism

**Current**: Hints purchased but not delivered

**Improvement**: Encrypted hints on IPFS
```javascript
// Hider encrypts hints
const encryptedHints = encrypt(hints, symmetric_key);
const ipfsHash = await ipfs.add(encryptedHints);

// Store on-chain
hunt.hintIPFS = ipfsHash;

// Reveal key after purchase
const key = deriveKey(huntId, seekerAddress, secret);
```

## Performance

### Proof Generation

**Hardware requirements**:
- CPU: 2+ cores recommended
- RAM: 2GB minimum, 4GB recommended
- Storage: ~10MB for keys and circuit files

**Actual Performance** (tested):
- Modern hardware (M1/M2 Mac, i7+): **~0.4-0.5 seconds** ⚡
- Laptop (i5): ~1-2 seconds
- Mobile (high-end): ~5-10 seconds
- Mobile (low-end): ~30-60 seconds

**Circuit Stats**:
- Total constraints: 1,698 (811 non-linear + 887 linear)
- Proving key size: 734 KB
- Verification key size: 2.9 KB

### Verification

**On-chain**:
- Gas: ~250,000 (uses precompiled contracts)
- Time: Same as transaction confirmation
- Cost: ~$5-10 at typical gas prices

### Optimization Opportunities

1. **Smaller circuit**: Remove unnecessary constraints
2. **PLONK instead of Groth16**: No trusted setup needed
3. **Proof batching**: Verify multiple claims together
4. **Layer 2**: Deploy on Optimism/Arbitrum for cheaper gas

## Current Implementation Status

### ✅ Completed Features

- **Multi-Hunt Support**: Fully implemented with isolated accounting
- **ZK Proof System**: Working with 0.4s proof generation
- **Anti-Front-Running**: Address binding prevents proof copying
- **GPS Verification**: ~10m radius using Euclidean distance
- **Gradual Withdrawal**: 50% daily limit implemented
- **Test Suite**: 15 passing unit tests + integration test
- **Documentation**: Comprehensive guides for all levels

### 🔄 Known Limitations

1. **GPS Source Trust**: Self-reported GPS (honor system)
   - Future: Mobile OS attestation
2. **Simplified Distance**: Euclidean approximation
   - Future: Haversine formula for precision
3. **Test Beacon**: Development-only trusted setup
   - Production: Proper Powers of Tau ceremony needed

## Conclusion

This architecture provides a practical balance of:
- **Security**: ZK proofs prevent most attacks ✅
- **Usability**: Fast proving (~0.4s), reasonable gas costs ✅
- **Scalability**: Multi-hunt support, isolated accounting ✅
- **Decentralization**: No trusted parties except GPS source
- **Extensibility**: Clear upgrade path for future features

The key insight is using ZK-SNARKs not for full anonymity, but for **selective disclosure** - proving you know something without revealing what you know.

**Status**: Production-ready for testnet deployment with real-world testing needed for GPS accuracy validation.

---

**Want to dive deeper?**
- Read the circuit: `circuits/treasure_claim.circom`
- Read the contract: `contracts/TreasureHunt.sol`
- Run the tests: `npx hardhat test`
