# SearchTogether 🏴‍☠️

A decentralized treasure hunt platform on Ethereum using Zero-Knowledge proofs.

## Overview

SearchTogether allows users to create real-world treasure hunts with cryptocurrency prizes. Hiders place QR codes at physical locations, and finders must prove they were at the location using ZK-SNARKs without revealing the secret or their exact GPS coordinates.

### Key Features

- **Zero-Knowledge Proofs**: Claim treasure without revealing secret or exact location
- **Anti-Front-Running**: Proofs are cryptographically bound to claimer's address
- **Gradual Withdrawal**: 50% daily withdrawal limit mitigates exploit risk
- **Hider Lockout**: Configurable period prevents instant self-claiming (minimum 1 day)
- **GPS Verification**: ~10 meter radius verification using simplified Euclidean distance
- **Multi-Hunt Support**: Supports unlimited concurrent hunts with isolated accounting
- **Fast Proofs**: ~0.4 seconds on modern hardware

### Security Model

1. **Secret from QR**: Proves finder discovered physical QR code
2. **GPS Proximity**: Proves finder was at location (within ~10m)
3. **Address Binding**: Prevents transaction copying/front-running
4. **Time-Lock Withdrawals**: Limits damage from potential exploits

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Hider     │      │    Finder    │      │  Attacker   │
│  Creates    │──┐   │   Scans QR   │      │   Watches   │
│   Hunt      │  │   │  Gets GPS    │      │   Mempool   │
└─────────────┘  │   └──────────────┘      └─────────────┘
                 │           │                     │
                 ▼           ▼                     ▼
         ┌───────────────────────────────────────────┐
         │        Ethereum Blockchain                │
         │  ┌─────────────────────────────────────┐ │
         │  │      TreasureHunt Contract          │ │
         │  │  - locationCommitment (public)      │ │
         │  │  - Verifies ZK proofs               │ │
         │  │  - Manages withdrawals              │ │
         │  └─────────────────────────────────────┘ │
         │  ┌─────────────────────────────────────┐ │
         │  │      Verifier Contract              │ │
         │  │  - On-chain proof verification      │ │
         │  └─────────────────────────────────────┘ │
         └───────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │      ZK-SNARK Circuit         │
         │                               │
         │  Private Inputs:              │
         │   - secret                    │
         │   - gpsLat, gpsLon           │
         │   - targetLat, targetLon      │
         │   - radiusSquared             │
         │   - claimerAddress            │
         │                               │
         │  Public Output:               │
         │   - claimCommitment           │
         │                               │
         │  Proves:                      │
         │   ✓ Know secret from QR       │
         │   ✓ GPS within ~10m           │
         │   ✓ Bound to address          │
         └───────────────────────────────┘
```

## Installation

### Prerequisites

- Node.js v18+
- npm or yarn
- Circom 2.0+
- snarkjs

### Install Circom

```bash
# build from source
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
```

### Install Project Dependencies

```bash
npm install
```

This installs:
- snarkjs (ZK proof generation/verification)
- circomlib (circuit libraries including Poseidon)
- Hardhat and all Ethereum development tools

## Setup

### 1. Compile the ZK Circuit

```bash
cd circuits
chmod +x compile.sh setup.sh
./compile.sh
./setup.sh
cd ..
```

This will:
- Compile the Circom circuit
- Download Powers of Tau (trusted setup)
- Generate proving and verification keys
- Generate Solidity verifier contract

### 2. Compile Smart Contracts

```bash
npx hardhat compile
```

### 3. Run Local Ethereum Node (Optional)

```bash
npx hardhat node
```

### 4. Deploy Contracts

```bash
# Local network
npx hardhat run scripts/deploy.js --network localhost

# Sepolia testnet (requires .env configuration)
npx hardhat run scripts/deploy.js --network sepolia
```

## Usage

### Create a Treasure Hunt

```bash
npx hardhat run scripts/createHunt.js --network localhost
```

This will:
1. Generate a random secret
2. Compute location commitment for your GPS coordinates
3. Deploy the hunt on-chain with initial prize
4. Output QR code data to encode

**Edit the script** to customize:
- GPS coordinates (`gpsLat`, `gpsLon`)
- Prize amount (`prizeEth`)
- Lockout period (`lockoutDays`)
- Hunt duration (`durationDays`)
- Hint price (`hintPriceEth`)

### Generate QR Code

Use the output from `createHunt.js` to generate a QR code containing:

```json
{
  "huntId": "0",
  "secret": "12345...",
  "lat": 37774900,
  "lon": -122419400,
  "radius": 10000,
  "network": "localhost",
  "contract": "0x..."
}
```

Print and place the QR code at the specified GPS location.

### Claim a Treasure

```bash
npx hardhat run scripts/claimHunt.js --network localhost
```

This will:
1. Read QR code data (from file or scan)
2. Get current GPS coordinates
3. Verify you're within ~10m radius
4. Generate ZK proof
5. Submit claim transaction

**Note**: For demo purposes, the script simulates GPS. In production, this would come from device GPS with OS attestation.

### Withdraw Prize

After claiming, withdraw 50% of the pot every 24 hours:

```bash
npx hardhat run scripts/withdraw.js --network localhost
```

## Testing

### Unit Tests (No ZK Proofs Required)

```bash
# Run all tests (uses MockVerifier)
npx hardhat test

# Expected: 15 passing tests in ~400ms
```

### Full Integration Test (With Real ZK Proofs)

```bash
# Complete end-to-end test with real proof generation
npx hardhat run scripts/testProofFlow.js --network hardhat

# This tests:
# - ZK proof generation (~0.4 seconds)
# - Off-chain verification
# - On-chain verification
# - Negative test cases
# - Full treasure hunt flow
```

### Gas Reporting

```bash
REPORT_GAS=true npx hardhat test
```

### Manual Testing

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed step-by-step testing instructions.

## Configuration

### GPS Coordinates

Coordinates are scaled by 1,000,000 to preserve 6 decimal places (~11cm precision):

```javascript
37.7749° → 37774900 (scaled)
```

### Radius

Fixed radius of **~10 meters** (100 scaled units):

```javascript
RADIUS_SCALED = 100
RADIUS_SQUARED = 10,000
```

This uses simplified Euclidean distance, which is accurate enough for small distances.

### Withdrawal Settings

```solidity
WITHDRAWAL_INTERVAL = 1 days
WITHDRAWAL_PERCENT = 50  // 50% per day
```

### Time Constraints

```solidity
MIN_HIDER_LOCKOUT = 1 days    // Minimum before hider can claim
MAX_HUNT_DURATION = 90 days   // Maximum hunt lifetime
```

## Smart Contract Interface

### Create Hunt

```solidity
function createHunt(
    uint256 _locationCommitment,  // Poseidon(lat, lon, radius²)
    uint256 _lockoutPeriod,        // Min 1 day before hider can claim
    uint256 _duration,             // Max 90 days total hunt lifetime
    uint256 _hintPrice             // Price in wei to buy a hint
) external payable returns (uint256 huntId)
```

**Multi-Hunt Support**: Returns unique `huntId` for isolated accounting

### Purchase Hint

```solidity
function purchaseHint(uint256 _huntId) external payable
```

### Claim Treasure

```solidity
function claimTreasure(
    uint256 _huntId,
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint256 _claimCommitment
) external
```

### Withdraw Prize

```solidity
function withdraw(uint256 _huntId) external
```

## ZK Circuit Details

### Inputs

**Private** (not revealed):
- `secret`: Value from QR code
- `gpsLat`, `gpsLon`: Finder's GPS coordinates
- `targetLat`, `targetLon`: Treasure GPS coordinates
- `radiusSquared`: Acceptable radius squared
- `claimerAddress`: Finder's Ethereum address

**Public** (visible on-chain):
- `claimCommitment`: Poseidon(locationCommitment, secretHash, claimerAddress)

### Circuit Logic

1. Compute `secretHash = Poseidon(secret)`
2. Compute `locationCommitment = Poseidon(targetLat, targetLon, radiusSquared)`
3. Verify `distance(gpsLat, gpsLon, targetLat, targetLon) <= radiusSquared`
4. Compute `claimCommitment = Poseidon(locationCommitment, secretHash, claimerAddress)`
5. Output `claimCommitment` as public signal

### Anti-Front-Running

The circuit binds the proof to a specific address:

1. Alice generates proof with her address → commitment_A
2. Bob sees proof in mempool and tries to copy it
3. Bob's address → commitment_B ≠ commitment_A
4. Contract verifies: computed commitment must match proof commitment
5. Bob's transaction **fails** ✅

## Security Considerations

### Assumptions

1. **ZK-SNARK soundness**: Can't forge proof without valid witness
2. **Hash preimage resistance**: Can't find secret from hash
3. **Strong entropy**: Secrets are randomly generated (256-bit)
4. **GPS source trust**: Device GPS is reasonably accurate

### Known Limitations

1. **GPS spoofing**: Advanced attackers could fake GPS signals
   - Mitigation: Use mobile OS attestation (iOS App Attest, Android SafetyNet)
   - Future: Integrate hardware-backed location proofs

2. **Hider self-claiming**: Hider knows location and secret
   - Mitigation: Lockout period + public pot growth incentivizes honest behavior
   - Economics make it unprofitable to rug small hunts

3. **Simplified distance**: Euclidean approximation less accurate over large distances
   - Current: Good for <1km radius at mid-latitudes
   - Future: Implement Haversine formula for precision

4. **Single hunt accounting**: Current contract assumes one hunt at a time
   - Production: Track per-hunt balances separately

## Performance Metrics

### Gas Costs

| Operation | Gas Usage | Cost at 30 gwei |
|-----------|-----------|-----------------|
| Deploy Groth16Verifier | ~1,000,000 | $6 @ $2000/ETH |
| Deploy TreasureHunt | ~1,500,000 | $9 |
| Create hunt | ~100,000 | $0.60 |
| Purchase hint | ~50,000 | $0.30 |
| Claim treasure | ~280,000 | $1.68 |
| Withdraw | ~30,000 | $0.18 |

### Proof Generation

- **Time**: ~0.4-0.5 seconds (modern hardware)
- **Circuit constraints**: 1,698 (811 non-linear + 887 linear)
- **Memory**: ~2GB RAM required
- **Mobile compatibility**: Yes (30-60 seconds on high-end devices)

## Current Status

✅ **Fully Implemented**:
- Multi-hunt support with isolated balances
- ZK proof generation and verification (~0.4s)
- Anti-front-running via address binding
- GPS verification within ~10m radius
- 50% daily withdrawal safety mechanism
- Complete test suite (15 passing tests)
- Comprehensive documentation

## Future Enhancements

- [ ] Hint reveal mechanism (encrypted hints on IPFS)
- [ ] Reputation system for hiders
- [ ] Mobile app with GPS attestation (iOS App Attest, Android SafetyNet)
- [ ] Factory contract for easier hunt deployment
- [ ] DAO governance for dispute resolution
- [ ] Integration with location oracles (e.g., FOAM, Platin)
- [ ] Support for ERC20 prizes
- [ ] Team hunts with split prizes
- [ ] Dynamic radius based on pot size
- [ ] Haversine distance formula for greater accuracy

## Development

### Project Structure

```
searchtogether/
├── circuits/              # ZK-SNARK circuits
│   ├── treasure_claim.circom
│   ├── compile.sh
│   └── setup.sh
├── contracts/             # Solidity smart contracts
│   ├── TreasureHunt.sol
│   └── Verifier.sol       (generated)
├── scripts/               # Deployment and interaction scripts
│   ├── deploy.js
│   ├── createHunt.js
│   ├── claimHunt.js
│   └── withdraw.js
├── test/                  # Contract and circuit tests
├── utils/                 # Helper utilities
│   ├── gps.js            # GPS conversion functions
│   └── hash.js           # Poseidon hashing
├── deployments/          # Deployment info (generated)
├── hunts/                # Hunt metadata (generated)
└── hardhat.config.js
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Testing New Circuits

```bash
cd circuits
# Edit treasure_claim.circom
./compile.sh
./setup.sh
cd ..
npx hardhat test
```

## License

MIT

## Acknowledgments

- [Circom](https://github.com/iden3/circom) - Circuit compiler
- [snarkjs](https://github.com/iden3/snarkjs) - ZK-SNARK JavaScript library
- [circomlib](https://github.com/iden3/circomlib) - Circuit library (Poseidon hash)
- [Hardhat](https://hardhat.org/) - Ethereum development environment

## Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/yourusername/searchtogether/issues)
- Discord: [Join community](#)

## Disclaimer

⚠️ **This is experimental software.** Use at your own risk. The smart contracts have not been audited. Do not use with significant funds on mainnet without a professional audit.

---

Built with ❤️ for the Ethereum community
