#!/usr/bin/env node

/**
 * Simple HTTP server for the SearchTogether web app
 * Serves static files with proper CORS headers for local testing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.zkey': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // Parse URL
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Get absolute path
    const absolutePath = path.join(__dirname, filePath);

    // Security check - ensure file is within webapp directory
    if (!absolutePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(absolutePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     SearchTogether Web App Server                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Server running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log('');
    console.log('📱 On your smartphone:');
    console.log(`   1. Connect to same WiFi network`);
    console.log(`   2. Find your computer's IP address`);
    console.log(`   3. Visit http://YOUR_IP:${PORT}`);
    console.log('');
    console.log('🛑 Press Ctrl+C to stop');
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error(`   Try: killall -9 node`);
        console.error(`   Or use a different port`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});
