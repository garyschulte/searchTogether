#!/bin/bash

# Circuit compilation script
# This compiles the Circom circuit and generates the constraint system

set -e

echo "🔧 Compiling circuit..."

# Compile the circuit to generate R1CS, WASM, and symbols
# -l flag specifies the include path for circomlib
circom treasure_claim.circom --r1cs --wasm --sym -l ../node_modules

echo "✅ Circuit compiled successfully!"
echo ""
echo "Generated files:"
echo "  - treasure_claim.r1cs (constraint system)"
echo "  - treasure_claim_js/treasure_claim.wasm (witness generator)"
echo "  - treasure_claim.sym (symbols for debugging)"
echo ""
echo "Next steps:"
echo "  1. Run ./setup.sh to generate proving/verification keys"
echo "  2. Run ./test_circuit.sh to test the circuit"
