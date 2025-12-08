// Global state (snarkjs will be loaded from CDN via script tag)
const state = {
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    huntData: null,
    location: null,
    proof: null,
    contract: null
};

// Constants
const COORDINATE_SCALE = 1000000;
const RADIUS_SCALED = 100;
const RADIUS_SQUARED = 10000;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkWalletConnection();
});

// Event Listeners
function initializeEventListeners() {
    // Wallet
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);

    // Hunt data input
    document.getElementById('scan-qr-btn').addEventListener('click', startQRScanner);
    document.getElementById('manual-entry-btn').addEventListener('click', showManualEntry);
    document.getElementById('load-hunt-data').addEventListener('click', loadHuntDataFromInputs);
    document.getElementById('clear-hunt-data').addEventListener('click', clearHuntData);

    // GPS
    document.getElementById('get-location').addEventListener('click', getLocation);
    document.getElementById('manual-gps-btn').addEventListener('click', showManualGPS);
    document.getElementById('load-manual-gps').addEventListener('click', loadManualGPS);
    document.getElementById('clear-gps').addEventListener('click', clearGPS);

    // Proof & Claim
    document.getElementById('generate-proof').addEventListener('click', generateProof);
    document.getElementById('submit-claim').addEventListener('click', submitClaim);

    // Error modal
    document.getElementById('close-error').addEventListener('click', closeErrorModal);

    // Auto-load hunt data from manual inputs
    ['hunt-id', 'secret', 'target-lat', 'target-lon', 'contract-address'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', checkManualInputComplete);
            input.addEventListener('change', checkManualInputComplete);
        }
    });

    // Auto-enable manual GPS button
    ['manual-gps-lat', 'manual-gps-lon'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', checkManualGPSComplete);
            input.addEventListener('change', checkManualGPSComplete);
        }
    });
}

// Wallet Functions
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    }
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showError('Please install MetaMask or another Web3 wallet');
            return;
        }

        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Get chainId directly from provider to avoid caching
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const chainIdFromProvider = parseInt(chainIdHex, 16);

        console.log('Chain ID from MetaMask:', chainIdFromProvider);
        console.log('Chain ID hex:', chainIdHex);

        // Initialize ethers provider with explicit network detection
        state.provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        state.signer = state.provider.getSigner();
        state.address = await state.signer.getAddress();

        // Get network
        const network = await state.provider.getNetwork();
        state.chainId = network.chainId;

        console.log('Network from ethers:', network);
        console.log('Chain ID from ethers:', state.chainId);

        // Warn if mismatch
        if (state.chainId !== chainIdFromProvider) {
            console.warn('Chain ID mismatch! MetaMask says', chainIdFromProvider, 'but ethers detected', state.chainId);
            state.chainId = chainIdFromProvider; // Trust MetaMask
        }

        // Update UI
        document.getElementById('connect-wallet').classList.add('hidden');
        document.getElementById('wallet-info').classList.remove('hidden');
        document.getElementById('wallet-address').textContent = formatAddress(state.address);
        document.getElementById('network-info').textContent = `Network: ${getNetworkName(state.chainId)} (Chain ID: ${state.chainId})`;

        // Listen for account/network changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        console.log('Wallet connected:', state.address);
        console.log('Connected to chain:', state.chainId);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        location.reload();
    } else {
        location.reload();
    }
}

function handleChainChanged() {
    location.reload();
}

// QR Scanner Functions
async function startQRScanner() {
    const scanner = document.getElementById('qr-scanner');
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');

    scanner.classList.remove('hidden');
    document.getElementById('manual-input').classList.add('hidden');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();

        requestAnimationFrame(() => scanQRCode(video, canvas, ctx, stream));
    } catch (error) {
        console.error('Error accessing camera:', error);
        showError('Cannot access camera. Please check permissions or use manual entry.');
        scanner.classList.add('hidden');
    }
}

function scanQRCode(video, canvas, ctx, stream) {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            try {
                const huntData = JSON.parse(code.data);
                loadHuntData(huntData);

                // Stop camera
                stream.getTracks().forEach(track => track.stop());
                document.getElementById('qr-scanner').classList.add('hidden');
                return;
            } catch (error) {
                console.error('Invalid QR code data:', error);
            }
        }
    }

    requestAnimationFrame(() => scanQRCode(video, canvas, ctx, stream));
}

function showManualEntry() {
    document.getElementById('qr-scanner').classList.add('hidden');
    document.getElementById('manual-input').classList.remove('hidden');
}

function checkManualInputComplete() {
    const huntId = document.getElementById('hunt-id').value;
    const secret = document.getElementById('secret').value;
    const targetLat = document.getElementById('target-lat').value;
    const targetLon = document.getElementById('target-lon').value;
    const contractAddress = document.getElementById('contract-address').value;

    const loadButton = document.getElementById('load-hunt-data');
    const allFilled = huntId && secret && targetLat && targetLon && contractAddress;

    loadButton.disabled = !allFilled;
}

function loadHuntDataFromInputs() {
    const huntId = document.getElementById('hunt-id').value;
    const secret = document.getElementById('secret').value;
    const targetLat = document.getElementById('target-lat').value;
    const targetLon = document.getElementById('target-lon').value;
    const contractAddress = document.getElementById('contract-address').value;

    const huntData = {
        huntId: parseInt(huntId),
        secret: secret,
        lat: Math.round(parseFloat(targetLat) * COORDINATE_SCALE),
        lon: Math.round(parseFloat(targetLon) * COORDINATE_SCALE),
        radius: RADIUS_SQUARED,
        contract: contractAddress
    };

    loadHuntData(huntData);
}

function loadHuntData(huntData) {
    state.huntData = huntData;

    // Hide input, show display
    document.getElementById('manual-input').classList.add('hidden');
    document.getElementById('qr-scanner').classList.add('hidden');
    document.getElementById('hunt-data-display').classList.remove('hidden');

    // Update display
    document.getElementById('display-hunt-id').textContent = huntData.huntId;
    document.getElementById('display-contract').textContent = formatAddress(huntData.contract);
    document.getElementById('display-contract').setAttribute('data-address', formatAddress(huntData.contract));

    console.log('Hunt data loaded:', huntData);

    // Enable next step
    checkProgress();
}

function clearHuntData() {
    state.huntData = null;
    document.getElementById('hunt-data-display').classList.add('hidden');
    document.getElementById('manual-input').classList.remove('hidden');
    checkProgress();
}

// GPS Functions
async function getLocation() {
    const button = document.getElementById('get-location');
    button.disabled = true;
    button.textContent = 'Getting location...';

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        state.location = {
            lat: Math.round(position.coords.latitude * COORDINATE_SCALE),
            lon: Math.round(position.coords.longitude * COORDINATE_SCALE),
            accuracy: position.coords.accuracy
        };

        // Update UI
        const locationInfo = document.getElementById('location-info');
        locationInfo.classList.remove('hidden');
        document.getElementById('current-lat').textContent =
            (state.location.lat / COORDINATE_SCALE).toFixed(6);
        document.getElementById('current-lon').textContent =
            (state.location.lon / COORDINATE_SCALE).toFixed(6);
        document.getElementById('gps-accuracy').textContent =
            `±${Math.round(state.location.accuracy)}m`;

        button.textContent = '✓ Location Obtained';
        button.classList.add('hidden');

        // Check distance if hunt data loaded
        if (state.huntData) {
            checkDistance();
        }

        checkProgress();
    } catch (error) {
        console.error('Error getting location:', error);
        showError('Failed to get location: ' + error.message);
        button.disabled = false;
        button.textContent = '📍 Auto GPS';
    }
}

function showManualGPS() {
    document.getElementById('manual-gps-input').classList.remove('hidden');
}

function checkManualGPSComplete() {
    const lat = document.getElementById('manual-gps-lat').value;
    const lon = document.getElementById('manual-gps-lon').value;
    const button = document.getElementById('load-manual-gps');
    button.disabled = !(lat && lon);
}

function loadManualGPS() {
    const lat = parseFloat(document.getElementById('manual-gps-lat').value);
    const lon = parseFloat(document.getElementById('manual-gps-lon').value);

    state.location = {
        lat: Math.round(lat * COORDINATE_SCALE),
        lon: Math.round(lon * COORDINATE_SCALE),
        accuracy: 0 // Manual entry has no accuracy metric
    };

    // Hide input, show display
    document.getElementById('manual-gps-input').classList.add('hidden');
    const locationInfo = document.getElementById('location-info');
    locationInfo.classList.remove('hidden');

    document.getElementById('current-lat').textContent = lat.toFixed(6);
    document.getElementById('current-lon').textContent = lon.toFixed(6);
    document.getElementById('gps-accuracy').textContent = 'Manual entry';

    // Check distance if hunt data loaded
    if (state.huntData) {
        checkDistance();
    }

    checkProgress();
    console.log('Manual GPS loaded:', state.location);
}

function clearGPS() {
    state.location = null;
    document.getElementById('location-info').classList.add('hidden');
    document.getElementById('manual-gps-input').classList.add('hidden');
    document.getElementById('get-location').classList.remove('hidden');
    document.getElementById('get-location').disabled = false;
    document.getElementById('get-location').textContent = '📍 Auto GPS';
    document.getElementById('manual-gps-lat').value = '';
    document.getElementById('manual-gps-lon').value = '';
    checkProgress();
}

function checkDistance() {
    const latDiff = state.location.lat - state.huntData.lat;
    const lonDiff = state.location.lon - state.huntData.lon;
    const distSquared = latDiff * latDiff + lonDiff * lonDiff;

    console.log('Distance check:');
    console.log('  Your location:', state.location.lat, state.location.lon);
    console.log('  Hunt location:', state.huntData.lat, state.huntData.lon);
    console.log('  Difference:', latDiff, lonDiff);
    console.log('  Distance²:', distSquared, 'vs threshold:', RADIUS_SQUARED);

    const distanceCheck = document.getElementById('distance-check');
    const distanceResult = document.getElementById('distance-result');
    distanceCheck.classList.remove('hidden');

    // Approximate distance in meters (for display only)
    const distMeters = Math.sqrt(distSquared) / COORDINATE_SCALE * 111000;

    if (distSquared <= RADIUS_SQUARED) {
        distanceResult.textContent = `✓ Within range (~${Math.round(distMeters)}m from target)`;
        distanceResult.className = 'success';
    } else {
        distanceResult.textContent = `⚠ Too far from target (~${Math.round(distMeters)}m away, need <${Math.sqrt(RADIUS_SQUARED) / COORDINATE_SCALE * 111000}m)`;
        distanceResult.className = 'warning';
    }
}

// Proof Generation
async function generateProof() {
    const button = document.getElementById('generate-proof');
    button.disabled = true;

    const proofStatus = document.getElementById('proof-status');
    const proofLoading = document.getElementById('proof-loading');
    const proofSuccess = document.getElementById('proof-success');

    proofStatus.classList.remove('hidden');
    proofLoading.classList.remove('hidden');
    proofSuccess.classList.add('hidden');

    const startTime = Date.now();

    try {
        // Prepare inputs
        const input = {
            secret: BigInt(state.huntData.secret).toString(),
            gpsLat: state.location.lat.toString(),
            gpsLon: state.location.lon.toString(),
            targetLat: state.huntData.lat.toString(),
            targetLon: state.huntData.lon.toString(),
            radiusSquared: RADIUS_SQUARED.toString(),
            claimerAddress: BigInt(state.address).toString()
        };

        console.log('Generating proof with inputs:', input);

        // Generate proof (this will take some time)
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            '/circuits/treasure_claim_js/treasure_claim.wasm',
            '/circuits/circuit_final.zkey'
        );

        const proofTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Store proof
        state.proof = {
            pA: [proof.pi_a[0], proof.pi_a[1]],
            pB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            pC: [proof.pi_c[0], proof.pi_c[1]],
            claimCommitment: publicSignals[0]
        };

        console.log('Proof generated:', state.proof);

        // Update UI
        proofLoading.classList.add('hidden');
        proofSuccess.classList.remove('hidden');
        document.getElementById('proof-time').textContent = `Generated in ${proofTime} seconds`;

        checkProgress();
    } catch (error) {
        console.error('Error generating proof:', error);
        showError('Failed to generate proof: ' + error.message);
        button.disabled = false;
        proofStatus.classList.add('hidden');
    }
}

// Claim Submission
async function submitClaim() {
    if (!state.signer || !state.proof || !state.huntData) {
        showError('Missing required data');
        return;
    }

    const button = document.getElementById('submit-claim');
    button.disabled = true;

    const claimStatus = document.getElementById('claim-status');
    const claimLoading = document.getElementById('claim-loading');
    const claimSuccess = document.getElementById('claim-success');

    claimStatus.classList.remove('hidden');
    claimLoading.classList.remove('hidden');
    claimSuccess.classList.add('hidden');

    try {
        // Check current network
        const network = await state.provider.getNetwork();
        console.log('Current network:', network);
        console.log('Chain ID:', network.chainId);
        console.log('Contract address:', state.huntData.contract);

        // Load contract
        const treasureHuntABI = await fetch('/TreasureHunt.json').then(r => r.json());
        const contract = new ethers.Contract(
            state.huntData.contract,
            treasureHuntABI,
            state.signer
        );

        console.log('Submitting claim transaction...');
        console.log('Hunt ID:', state.huntData.huntId);
        console.log('Proof commitment:', state.proof.claimCommitment);

        // Submit claim
        const tx = await contract.claimTreasure(
            state.huntData.huntId,
            state.proof.pA,
            state.proof.pB,
            state.proof.pC,
            state.proof.claimCommitment
        );

        console.log('Transaction submitted:', tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);

        // Update UI
        claimLoading.classList.add('hidden');
        claimSuccess.classList.remove('hidden');
        document.getElementById('tx-hash').textContent = tx.hash;

        const explorerLink = document.getElementById('etherscan-link');
        explorerLink.href = getExplorerUrl(tx.hash);

    } catch (error) {
        console.error('Error submitting claim:', error);
        showError('Failed to submit claim: ' + error.message);
        button.disabled = false;
        claimStatus.classList.add('hidden');
    }
}

// Progress Checking
function checkProgress() {
    // Enable proof generation if wallet connected, hunt data loaded, and location obtained
    const canGenerateProof = state.address && state.huntData && state.location;
    document.getElementById('generate-proof').disabled = !canGenerateProof;

    // Enable claim submission if proof generated
    const canSubmitClaim = state.proof;
    document.getElementById('submit-claim').disabled = !canSubmitClaim;
}

// Utility Functions
function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkName(chainId) {
    const networks = {
        1: 'Ethereum Mainnet',
        5: 'Goerli Testnet',
        11155111: 'Sepolia Testnet',
        31337: 'Hardhat Local',
        1337: 'Localhost'
    };
    return networks[chainId] || `Chain ID ${chainId}`;
}

function getExplorerUrl(txHash) {
    const explorers = {
        1: 'https://etherscan.io',
        5: 'https://goerli.etherscan.io',
        11155111: 'https://sepolia.etherscan.io'
    };
    const baseUrl = explorers[state.chainId] || 'https://etherscan.io';
    return `${baseUrl}/tx/${txHash}`;
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-modal').classList.remove('hidden');
}

function closeErrorModal() {
    document.getElementById('error-modal').classList.add('hidden');
}

// Export for debugging
window.state = state;
