#!/bin/bash

###############################################################################
# One-Time Setup Script for Zero-Downtime Deployment
# Run this once to set up the deployment infrastructure
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Zero-Downtime Deployment Setup                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
BASE_DIR="/home/ubuntu"
RELEASES_DIR="$BASE_DIR/releases"
LOGS_DIR="$BASE_DIR/logs"
CURRENT_LINK="$BASE_DIR/current"

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Create directories
print_step "Creating required directories..."
mkdir -p "$RELEASES_DIR"
mkdir -p "$LOGS_DIR"
echo "  ✓ $RELEASES_DIR"
echo "  ✓ $LOGS_DIR"

# Check if PM2 is installed
print_step "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found. Installing PM2..."
    npm install -g pm2
    echo "  ✓ PM2 installed"
else
    echo "  ✓ PM2 already installed ($(pm2 --version))"
fi

# Stop existing PM2 processes if any
print_step "Checking existing PM2 processes..."
if pm2 list | grep -q "email-monitor\|email-websocket"; then
    print_warning "Found existing PM2 processes. Stopping them..."
    pm2 stop email-monitor email-websocket 2>/dev/null || true
    pm2 delete email-monitor email-websocket 2>/dev/null || true
    echo "  ✓ Existing processes stopped"
else
    echo "  ✓ No existing processes found"
fi

# Check if current symlink exists
if [ -L "$CURRENT_LINK" ]; then
    print_warning "Current symlink already exists: $CURRENT_LINK"
    echo "  This is okay if you're re-running setup"
fi

# Make scripts executable
print_step "Making deployment scripts executable..."
cd /home/ubuntu/Email-Monitor-Dashboard
chmod +x scripts/deploy-zero-downtime.sh
chmod +x scripts/rollback.sh
echo "  ✓ deploy-zero-downtime.sh"
echo "  ✓ rollback.sh"

# Setup PM2 startup script
print_step "Configuring PM2 to start on system boot..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu
echo "  ✓ PM2 startup configured"

# Create logrotate configuration
print_step "Setting up log rotation..."
sudo tee /etc/logrotate.d/email-monitor > /dev/null <<EOF
$LOGS_DIR/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    create 0640 ubuntu ubuntu
}
EOF
echo "  ✓ Logrotate configured"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Setup Complete!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Run your first deployment:"
echo "   ${BLUE}cd /home/ubuntu/Email-Monitor-Dashboard${NC}"
echo "   ${BLUE}./scripts/deploy-zero-downtime.sh${NC}"
echo ""
echo "2. Check PM2 status:"
echo "   ${BLUE}pm2 list${NC}"
echo ""
echo "3. View logs:"
echo "   ${BLUE}pm2 logs${NC}"
echo ""
echo "4. To rollback if needed:"
echo "   ${BLUE}./scripts/rollback.sh${NC}"
echo ""
echo -e "${GREEN}Documentation: ZERO_DOWNTIME_DEPLOYMENT.md${NC}"
echo ""

exit 0

