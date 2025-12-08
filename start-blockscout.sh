#!/bin/bash

echo "🔍 Starting Blockscout Block Explorer..."
echo ""
echo "Prerequisites:"
echo "  ✓ Docker must be installed and running"
echo "  ✓ Hardhat node must be running on localhost:8545"
echo ""
echo "Starting services..."
echo ""

docker compose -f docker-compose-blockscout.yml up -d

echo ""
echo "⏳ Waiting for services to start (this may take 30-60 seconds)..."
sleep 10

echo ""
echo "✅ Blockscout is starting up!"
echo ""
echo "📊 Access the explorer at:"
echo "   http://localhost:4000"
echo ""
echo "🔗 Connected to Hardhat node at:"
echo "   http://localhost:8545"
echo ""
echo "📝 To view logs:"
echo "   docker-compose -f docker-compose-blockscout.yml logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose -f docker-compose-blockscout.yml down"
echo ""
