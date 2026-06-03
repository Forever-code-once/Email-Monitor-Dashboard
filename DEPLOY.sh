#!/bin/bash

# Email Monitor Dashboard - Deployment Script
# Implements improvements: Email date tracking, Smart chunking, Latest-only display

set -e  # Exit on error

echo "🚀 Starting deployment of Email Monitor Dashboard improvements..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} In correct directory: $(pwd)"

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

# Step 3: Build the application
echo ""
echo "🔨 Building Next.js application..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Please fix errors and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build completed successfully"

# Step 4: Stop old PM2 processes
echo ""
echo "🛑 Stopping old PM2 processes..."
pm2 stop ecosystem.config.js || true

# Step 5: Start new PM2 processes
echo ""
echo "▶️  Starting new PM2 processes..."
pm2 start ecosystem.config.js

# Step 6: Save PM2 configuration
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Step 7: Check status
echo ""
echo "📊 Checking PM2 status..."
pm2 list

# Step 8: Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Step 9: Test services
echo ""
echo "🧪 Testing services..."

# Test Next.js dashboard
if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓${NC} Next.js dashboard is running on port 3000"
else
    echo -e "${YELLOW}⚠${NC}  Next.js dashboard may not be ready yet (still starting)"
fi

# Test WebSocket servers
for port in 8080 8081 8082; do
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓${NC} WebSocket server is running on port $port"
    else
        echo -e "${YELLOW}⚠${NC}  WebSocket server on port $port may not be ready yet"
    fi
done

# Step 10: Show recent logs
echo ""
echo "📋 Recent logs (last 20 lines):"
echo "================================"
pm2 logs nextjs-dashboard --nostream --lines 20

echo ""
echo ""
echo "========================================"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "========================================"
echo ""
echo "📝 Next steps:"
echo "   1. Visit http://localhost:3000 to test the dashboard"
echo "   2. Monitor logs: pm2 logs nextjs-dashboard"
echo "   3. Check status: pm2 status"
echo ""
echo "📖 Documentation:"
echo "   - See EMAIL_PARSING_IMPROVEMENTS.md for details"
echo "   - See QUICK_FIX_INSTRUCTIONS.txt for troubleshooting"
echo ""
echo "🎉 Improvements deployed:"
echo "   ✓ Email sent date tracking"
echo "   ✓ Smart email chunking (no token limits)"
echo "   ✓ Latest-only data display"
echo "   ✓ Date-based cleanup logic"
echo ""



