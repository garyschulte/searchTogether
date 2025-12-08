# SearchTogether Web App

Mobile-friendly web application for claiming treasure hunts with ZK proofs.

## Quick Start

```bash
# 1. Start the server
node server.js

# 2. Open in browser
# Desktop: http://localhost:8080
# Mobile: http://YOUR_IP:8080
```

## Features

- 📱 **Mobile-First**: Optimized for smartphones
- 🔗 **Web3 Wallet**: MetaMask, WalletConnect support
- 📷 **QR Scanner**: Scan treasure QR codes with camera
- 📍 **GPS**: Automatic location from browser
- 🔐 **ZK Proofs**: Generate proofs in browser (~1-60s)
- ⛓️ **Blockchain**: Submit claims to Ethereum

## Requirements

- Node.js (for local server)
- Web3 wallet (MetaMask mobile recommended)
- Modern smartphone browser
- GPS and camera permissions

## File Structure

```
webapp/
├── README.md              # This file
├── index.html             # Main app
├── styles.css             # Responsive styling
├── app.js                 # Application logic
├── server.js              # Local HTTP server
├── TreasureHunt.json      # Contract ABI
└── circuits/              # ZK circuit files (copied from ../circuits/)
    ├── treasure_claim_js/
    │   └── treasure_claim.wasm
    └── circuit_final.zkey
```

## Setup

### 1. Copy Circuit Files (if not done)

```bash
cd ..
cp -r circuits/treasure_claim_js webapp/circuits/
cp circuits/circuit_final.zkey webapp/circuits/
```

### 2. Start Development Server

```bash
cd webapp
node server.js
```

### 3. Access on Mobile

1. Find your computer's IP:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. Connect phone to same WiFi network

3. Open browser on phone: `http://YOUR_IP:8080`

## Usage Flow

1. **Connect Wallet** → Approve MetaMask connection
2. **Enter Hunt Data** → Scan QR or manual entry
3. **Get Location** → Allow GPS access
4. **Generate Proof** → Wait 1-60 seconds
5. **Submit Claim** → Approve transaction
6. **Success!** → Treasure claimed 🎉

## Testing Locally

### Terminal 1: Blockchain
```bash
npx hardhat node
```

### Terminal 2: Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/createHunt.js --network localhost
```

### Terminal 3: Web Server
```bash
cd webapp
node server.js
```

### Terminal 4: (Optional) Test Script
```bash
npx hardhat run scripts/testProofFlow.js --network hardhat
```

## Configuration

### MetaMask (Localhost)
- Network: Hardhat Local
- RPC: http://localhost:8545
- Chain ID: 31337

### MetaMask (Sepolia)
- Network: Sepolia Testnet
- RPC: https://rpc.sepolia.org
- Chain ID: 11155111

## Troubleshooting

### Circuit files not found
```bash
cp -r ../circuits/treasure_claim_js circuits/
cp ../circuits/circuit_final.zkey circuits/
```

### Port 8080 in use
```bash
killall -9 node
# Or edit server.js to use different port
```

### GPS not working
- Needs HTTPS in production (localhost is OK for dev)
- Check browser permissions
- Go outdoors for better signal

### Proof generation fails
- Check browser console (F12)
- Verify circuit files exist
- Try on more powerful device
- Ensure sufficient free RAM

## Performance

| Device | Proof Time |
|--------|------------|
| iPhone 14 | ~0.5s |
| iPhone 12 | ~1-2s |
| High-end Android | ~1-2s |
| Mid-range | ~5-15s |
| Older phones | ~30-60s |

## Documentation

See [WEBAPP_GUIDE.md](../WEBAPP_GUIDE.md) for complete documentation.

## Deployment

For production deployment:

1. Use HTTPS (required for camera/GPS)
2. Deploy to: Vercel, Netlify, GitHub Pages, etc.
3. Update contract addresses in app
4. Test thoroughly on testnet first!

## Next Steps

- [ ] Add withdrawal interface
- [ ] Hunt creation UI
- [ ] Hunt browsing/discovery
- [ ] PWA with offline support
- [ ] QR code generator
- [ ] Transaction history

## Support

Issues? Check:
1. Browser console errors (F12)
2. Server logs
3. [WEBAPP_GUIDE.md](../WEBAPP_GUIDE.md)
4. GitHub issues

---

Happy treasure hunting! 🏴‍☠️
