# Quick Start Guide

Get your first treasure hunt running in 5 minutes!

## Prerequisites

- Node.js v18+ installed
- 10 minutes of your time

## Installation

```bash
# Clone or navigate to the project
cd searchtogether

# Install dependencies
npm install

# Install Circom (if not already installed)
# macOS:
brew install circom

# Linux/Unix:
# Download from https://github.com/iden3/circom/releases
# Or build from source:
git clone https://github.com/iden3/circom.git
cd circom && cargo build --release && cargo install --path circom
```

## Setup (First Time Only)

### 1. Compile the Circuit

```bash
cd circuits
./compile.sh
```

This takes ~1-2 seconds and generates:
- Constraint system (treasure_claim.r1cs)
- Witness generator (WASM)
- 1,698 constraints total

### 2. Generate Keys

```bash
./setup.sh
```

This takes ~1-2 minutes and downloads/generates:
- Powers of Tau file (~5MB download from Google Cloud)
- Proving keys (circuit_final.zkey - 734KB)
- Verification keys (verification_key.json - 2.9KB)
- Solidity verifier contract (Groth16Verifier.sol - 6.9KB)

```bash
cd ..
```

### 3. Compile Contracts

```bash
npx hardhat compile
```

## Running Your First Hunt

### Terminal 1: Start Local Blockchain

```bash
npx hardhat node
```

Leave this running. It will show accounts with ETH for testing.

### Terminal 2: Deploy & Create Hunt

```bash
# Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Create a hunt
npx hardhat run scripts/createHunt.js --network localhost
```

The `createHunt.js` script will output:
- Hunt ID
- Secret value
- GPS coordinates
- QR code data to encode

**Save this information!** You'll need it to test claiming.

### Terminal 2: Claim the Hunt

```bash
npx hardhat run scripts/claimHunt.js --network localhost
```

This will:
1. Read the hunt data from `hunts/hunt_0.json`
2. Simulate being at the location
3. Generate a ZK proof (~0.4 seconds on modern hardware!)
4. Submit the claim
5. Success! 🎉

### Alternative: Run Complete Test

```bash
# Full automated test with real ZK proofs
npx hardhat run scripts/testProofFlow.js --network hardhat

# This tests everything:
# - Proof generation and verification
# - Negative test cases
# - Full treasure hunt flow
# Expected: All tests pass in ~5 seconds
```

### Terminal 2: Withdraw Prize

```bash
npx hardhat run scripts/withdraw.js --network localhost
```

You can withdraw 50% immediately, then 50% of remaining after 24 hours.

To test multiple withdrawals:

```bash
# First withdrawal (50% of pot)
npx hardhat run scripts/withdraw.js --network localhost

# Fast forward 24 hours in local blockchain
npx hardhat test test/fastforward.js

# Second withdrawal (50% of remaining = 25% of original)
npx hardhat run scripts/withdraw.js --network localhost
```

## What Just Happened?

1. **Circuit Compilation**: Your Circom circuit was compiled into a constraint system (1,698 constraints)
2. **Key Generation**: Cryptographic keys were generated for the ZK-SNARK (Groth16)
3. **Contract Deployment**: Two contracts deployed:
   - `Groth16Verifier.sol`: Verifies ZK proofs on-chain (~1M gas)
   - `TreasureHunt.sol`: Manages hunts and prizes (~1.5M gas)
4. **Hunt Creation**: A treasure hunt was created with:
   - Random 256-bit secret
   - GPS location (San Francisco by default)
   - 0.01 ETH prize
   - 2-day lockout for hider (minimum required)
5. **Claim**: A ZK proof was generated proving:
   - Knowledge of the secret
   - GPS within ~10m of target
   - Cryptographic binding to your address (prevents front-running)
   - **Proof generated in ~0.4 seconds!**
6. **Withdrawal**: Prize withdrawn in 50% daily increments (security feature)

## Customizing Your Hunt

Edit `scripts/createHunt.js`:

```javascript
const huntConfig = {
    gpsLat: 40.7128,           // Your latitude
    gpsLon: -74.0060,          // Your longitude
    prizeEth: "0.1",           // Prize amount
    lockoutDays: 3,            // Days before hider can claim
    durationDays: 30,          // Hunt expiration
    hintPriceEth: "0.005"      // Cost for hints
};
```

## Testing

Run the test suite:

```bash
npx hardhat test
```

Expected output:
```
  TreasureHunt
    Hunt Creation
      ✓ Should create a hunt with initial prize
      ✓ Should reject hunt with zero prize
      ✓ Should reject hunt with lockout too short
    Hint Purchases
      ✓ Should allow purchasing hints
      ✓ Should reject insufficient payment
      ✓ Should reject duplicate purchases
    Claiming
      ✓ Should allow claiming with valid proof
      ✓ Should reject claim during lockout period
      ✓ Should reject duplicate claims
    Withdrawals
      ✓ Should allow immediate first withdrawal
      ✓ Should enforce 24-hour withdrawal interval
      ✓ Should allow second withdrawal after 24 hours
      ✓ Should only allow claimer to withdraw
    Hunt Expiration
      ✓ Should allow hider to reclaim funds after expiration
      ✓ Should reject expiration before time

  14 passing (2s)
```

## Troubleshooting

### "circom: command not found"

Install Circom:
```bash
brew install circom  # macOS
# or download from https://github.com/iden3/circom/releases
```

### "Cannot find module 'snarkjs'"

```bash
npm install
```

### "Proof generation failed"

Make sure you ran the setup:
```bash
cd circuits
./compile.sh
./setup.sh
cd ..
```

### "Transaction reverted: Still in lockout period"

The hider must wait for the lockout period (default 2 days). Either:
1. Use a different account to claim
2. Fast-forward time in local blockchain
3. Reduce lockout in `createHunt.js`

### Circuits take forever to compile

The circuit is small and should compile in <1 minute. If it's hanging:
1. Make sure you have enough RAM (2GB+)
2. Try closing other applications
3. Check Circom version: `circom --version` (should be 2.0+)

## Next Steps

- **Deploy to testnet**: Edit `.env` with Sepolia RPC and private key
- **Generate real QR codes**: Use a QR code library to encode the hunt data
- **Build a frontend**: Connect with Web3.js or Ethers.js
- **Add GPS from device**: Integrate with mobile GPS APIs
- **Create multiple hunts**: Run `createHunt.js` multiple times

## Project Structure

```
searchtogether/
├── circuits/              # ZK circuit source
│   ├── treasure_claim.circom
│   ├── compile.sh
│   └── setup.sh
├── contracts/            # Solidity contracts
│   ├── TreasureHunt.sol
│   ├── MockVerifier.sol  # For testing
│   └── Verifier.sol      # Generated from circuit
├── scripts/              # Interaction scripts
│   ├── deploy.js         # Deploy to network
│   ├── createHunt.js     # Create new hunt
│   ├── claimHunt.js      # Claim treasure
│   └── withdraw.js       # Withdraw prize
├── test/                 # Contract tests
├── utils/                # Helper functions
│   ├── gps.js           # GPS coordinate conversion
│   └── hash.js          # Poseidon hashing
├── deployments/         # Deployment addresses (generated)
└── hunts/               # Hunt metadata (generated)
```

## Learn More

- **README.md**: Full documentation
- **Architecture**: See README for security model and ZK circuit details
- **Smart Contracts**: Check `contracts/TreasureHunt.sol` for interface
- **Circuit Logic**: See `circuits/treasure_claim.circom` for ZK proof

## Questions?

- Check the README.md for detailed documentation
- Review the code comments
- Open an issue on GitHub

---

Happy treasure hunting! 🏴‍☠️
