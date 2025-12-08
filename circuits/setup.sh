#!/bin/bash

# Circuit setup script
# Generates proving and verification keys using Powers of Tau ceremony

set -e

echo "🔐 Setting up ZK-SNARK keys..."

# Download Powers of Tau file if not exists
# Using 12th power (2^12 = 4096 constraints) - should be enough for our circuit
PTAU_FILE="powersOfTau28_hez_final_12.ptau"

if [ ! -f "$PTAU_FILE" ]; then
    echo "📥 Downloading Powers of Tau file (~7MB)..."
    echo "This may take a minute..."

    # Try multiple sources
    if command -v curl &> /dev/null; then
        curl -L -o $PTAU_FILE https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau || \
        curl -L -o $PTAU_FILE https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
    elif command -v wget &> /dev/null; then
        wget -O $PTAU_FILE https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau || \
        wget -O $PTAU_FILE https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
    else
        echo "❌ Error: Neither curl nor wget found. Please install one of them."
        exit 1
    fi

    if [ ! -f "$PTAU_FILE" ]; then
        echo "❌ Error: Failed to download Powers of Tau file."
        echo "Please download manually from:"
        echo "  https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau"
        echo "Or:"
        echo "  https://github.com/iden3/snarkjs#7-prepare-phase-2"
        exit 1
    fi
fi

echo "🔑 Generating proving key (this may take a minute)..."

# Generate initial zkey
npx snarkjs groth16 setup treasure_claim.r1cs $PTAU_FILE circuit_0000.zkey

# Apply random beacon (for production, use a proper ceremony)
npx snarkjs zkey beacon circuit_0000.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

echo "📄 Generating verification key..."
npx snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

echo "📜 Generating Solidity verifier..."
npx snarkjs zkey export solidityverifier circuit_final.zkey ../contracts/Verifier.sol

echo "✅ Setup complete!"
echo ""
echo "Generated files:"
echo "  - circuit_final.zkey (proving key)"
echo "  - verification_key.json (verification key)"
echo "  - ../contracts/Verifier.sol (Solidity verifier contract)"
echo ""
echo "⚠️  WARNING: This setup uses a test beacon for development."
echo "    For production, conduct a proper trusted setup ceremony!"
