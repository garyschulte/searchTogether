// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockVerifier
 * @dev Mock ZK proof verifier for testing
 * Always returns true to allow testing without generating real proofs
 */
contract MockVerifier {
    /**
     * @dev Mock verification function
     * Always returns true for testing purposes
     */
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external pure returns (bool) {
        // Suppress unused variable warnings
        _pA;
        _pB;
        _pC;
        _pubSignals;

        // Always return true for testing
        return true;
    }
}
