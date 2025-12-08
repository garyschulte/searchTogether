/**
 * Hashing Utilities
 *
 * Provides Poseidon hash functions for circuit compatibility
 */

const { buildPoseidon } = require("circomlibjs");

let poseidonInstance = null;

/**
 * Initialize Poseidon hasher (call once at startup)
 */
async function initPoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon();
    }
    return poseidonInstance;
}

/**
 * Compute Poseidon hash
 * @param {Array|BigInt} inputs - Input values to hash
 * @returns {string} Hash as hex string
 */
async function poseidonHash(inputs) {
    const poseidon = await initPoseidon();

    // Ensure inputs is an array
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    // Convert inputs to BigInt if needed
    const bigIntInputs = inputs.map(x => {
        if (typeof x === 'bigint') return x;
        if (typeof x === 'number') return BigInt(x);
        if (typeof x === 'string') {
            // Handle hex strings
            if (x.startsWith('0x')) {
                return BigInt(x);
            }
            return BigInt(x);
        }
        throw new Error(`Invalid input type: ${typeof x}`);
    });

    const hash = poseidon(bigIntInputs);
    return poseidon.F.toString(hash);
}

/**
 * Compute location commitment
 * @param {number} lat - Latitude (scaled)
 * @param {number} lon - Longitude (scaled)
 * @param {number} radiusSquared - Radius squared (scaled)
 * @returns {string} Poseidon hash
 */
async function computeLocationCommitment(lat, lon, radiusSquared) {
    return await poseidonHash([lat, lon, radiusSquared]);
}

/**
 * Compute secret hash
 * @param {number|BigInt} secret - Secret value from QR code
 * @returns {string} Poseidon hash
 */
async function computeSecretHash(secret) {
    return await poseidonHash([secret]);
}

/**
 * Compute claim commitment
 * Binds location, secret, and claimer address together
 *
 * @param {string} locationCommitment - Location commitment hash
 * @param {string} secretHash - Secret hash
 * @param {string} claimerAddress - Ethereum address (0x...)
 * @returns {string} Poseidon hash
 */
async function computeClaimCommitment(locationCommitment, secretHash, claimerAddress) {
    // Convert address to BigInt
    const addressBigInt = BigInt(claimerAddress);

    return await poseidonHash([
        BigInt(locationCommitment),
        BigInt(secretHash),
        addressBigInt
    ]);
}

/**
 * Generate random secret for QR code
 * @returns {BigInt} Random 256-bit secret
 */
function generateSecret() {
    // Generate random bytes
    const bytes = require('crypto').randomBytes(32);
    return BigInt('0x' + bytes.toString('hex'));
}

/**
 * Convert Ethereum address to BigInt
 * @param {string} address - Ethereum address (0x...)
 * @returns {BigInt} Address as BigInt
 */
function addressToBigInt(address) {
    if (!address.startsWith('0x')) {
        address = '0x' + address;
    }
    return BigInt(address);
}

/**
 * Convert BigInt to Ethereum address
 * @param {BigInt} value - Address as BigInt
 * @returns {string} Ethereum address (0x...)
 */
function bigIntToAddress(value) {
    const hex = value.toString(16).padStart(40, '0');
    return '0x' + hex;
}

module.exports = {
    initPoseidon,
    poseidonHash,
    computeLocationCommitment,
    computeSecretHash,
    computeClaimCommitment,
    generateSecret,
    addressToBigInt,
    bigIntToAddress
};
