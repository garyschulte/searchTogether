/**
 * GPS Coordinate Utilities
 *
 * Handles conversion between decimal degrees and scaled integers
 * Scale factor: 1,000,000 (preserves 6 decimal places ~11cm precision)
 */

const COORDINATE_SCALE = 1000000;
const RADIUS_SCALED = 100; // ~10 meters
const RADIUS_SQUARED = RADIUS_SCALED * RADIUS_SCALED; // 10,000

/**
 * Convert decimal degrees to scaled integer
 * @param {number} degrees - GPS coordinate in decimal degrees
 * @returns {number} Scaled integer coordinate
 *
 * Example:
 *   37.7749° → 37774900
 *   -122.4194° → -122419400
 */
function degreesToScaled(degrees) {
    return Math.round(degrees * COORDINATE_SCALE);
}

/**
 * Convert scaled integer back to decimal degrees
 * @param {number} scaled - Scaled integer coordinate
 * @returns {number} GPS coordinate in decimal degrees
 *
 * Example:
 *   37774900 → 37.7749°
 *   -122419400 → -122.4194°
 */
function scaledToDegrees(scaled) {
    return scaled / COORDINATE_SCALE;
}

/**
 * Calculate Euclidean distance between two GPS points (simplified)
 * @param {number} lat1 - Latitude 1 (scaled)
 * @param {number} lon1 - Longitude 1 (scaled)
 * @param {number} lat2 - Latitude 2 (scaled)
 * @param {number} lon2 - Longitude 2 (scaled)
 * @returns {number} Distance squared (scaled units)
 *
 * Note: This is a simplified calculation. For large distances or
 * high precision, use Haversine formula instead.
 */
function distanceSquared(lat1, lon1, lat2, lon2) {
    const latDiff = lat1 - lat2;
    const lonDiff = lon1 - lon2;
    return latDiff * latDiff + lonDiff * lonDiff;
}

/**
 * Check if two GPS points are within acceptable radius
 * @param {number} lat1 - Latitude 1 (scaled)
 * @param {number} lon1 - Longitude 1 (scaled)
 * @param {number} lat2 - Latitude 2 (scaled)
 * @param {number} lon2 - Longitude 2 (scaled)
 * @returns {boolean} True if within ~10m radius
 */
function isWithinRadius(lat1, lon1, lat2, lon2) {
    const distSq = distanceSquared(lat1, lon1, lat2, lon2);
    return distSq <= RADIUS_SQUARED;
}

/**
 * Estimate actual distance in meters (approximate)
 * @param {number} scaledDistance - Distance in scaled units
 * @returns {number} Approximate distance in meters
 *
 * Note: This is approximate. At equator:
 * - 1° latitude ≈ 111,000 meters
 * - 1° longitude ≈ 111,000 meters
 * - 1 scaled unit ≈ 0.111 meters
 */
function scaledToMeters(scaledDistance) {
    // Average meters per degree at mid-latitudes
    const METERS_PER_DEGREE = 111000;
    const DEGREES_PER_SCALED = 1 / COORDINATE_SCALE;
    return scaledDistance * DEGREES_PER_SCALED * METERS_PER_DEGREE;
}

/**
 * Format coordinates for display
 * @param {number} lat - Latitude (scaled or degrees)
 * @param {number} lon - Longitude (scaled or degrees)
 * @param {boolean} isScaled - Whether input is scaled
 * @returns {string} Formatted coordinate string
 */
function formatCoordinates(lat, lon, isScaled = true) {
    if (isScaled) {
        lat = scaledToDegrees(lat);
        lon = scaledToDegrees(lon);
    }

    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';

    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`;
}

/**
 * Validate GPS coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @returns {boolean} True if valid
 */
function isValidCoordinates(lat, lon) {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Generate random GPS offset for testing
 * @param {number} centerLat - Center latitude (scaled)
 * @param {number} centerLon - Center longitude (scaled)
 * @param {number} maxOffset - Maximum offset in scaled units
 * @returns {object} {lat, lon} with random offset applied
 */
function randomOffset(centerLat, centerLon, maxOffset = RADIUS_SCALED) {
    const offsetLat = Math.floor(Math.random() * maxOffset * 2) - maxOffset;
    const offsetLon = Math.floor(Math.random() * maxOffset * 2) - maxOffset;

    return {
        lat: centerLat + offsetLat,
        lon: centerLon + offsetLon
    };
}

module.exports = {
    COORDINATE_SCALE,
    RADIUS_SCALED,
    RADIUS_SQUARED,
    degreesToScaled,
    scaledToDegrees,
    distanceSquared,
    isWithinRadius,
    scaledToMeters,
    formatCoordinates,
    isValidCoordinates,
    randomOffset
};
