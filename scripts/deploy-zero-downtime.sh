#!/bin/bash

###############################################################################
# Zero-Downtime Deployment Script for Next.js on EC2
# Fixes chunk loading errors by using blue-green deployment strategy
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="Email-Monitor-Dashboard"
BASE_DIR="/home/ubuntu"
REPO_DIR="$BASE_DIR/$PROJECT_NAME"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
KEEP_RELEASES=3  # Keep last 3 releases

# PM2 app names
PM2_APP_NAME="email-monitor"
PM2_WEBSOCKET_NAME="email-websocket"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Zero-Downtime Deployment for Email Monitor Dashboard   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "\n${RED}✗ Error: $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "\n${YELLOW}⚠ Warning: $1${NC}"
}

# Function to print success
print_success() {
    echo -e "\n${GREEN}✓ $1${NC}"
}

# Check if running as correct user
if [ "$USER" != "ubuntu" ]; then
    print_error "This script must be run as the ubuntu user"
    exit 1
fi

# Create releases directory if it doesn't exist
print_step "Setting up deployment directories..."
mkdir -p "$RELEASES_DIR"

# Generate release timestamp
RELEASE_NAME=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

print_step "Creating new release: $RELEASE_NAME"
mkdir -p "$RELEASE_DIR"

# Clone/pull latest code
print_step "Fetching latest code from repository..."
cd "$REPO_DIR"

# Stash any local changes
git stash

# Fetch latest changes
git fetch origin main

# Get current commit hash
OLD_COMMIT=$(git rev-parse HEAD)
NEW_COMMIT=$(git rev-parse origin/main)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    print_warning "No new changes to deploy. Current commit: $OLD_COMMIT"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi
fi

# Pull latest changes
git pull origin main

print_success "Code updated from $OLD_COMMIT to $NEW_COMMIT"

# Copy code to release directory
print_step "Copying code to release directory..."
rsync -a --exclude='.git' \
         --exclude='node_modules' \
         --exclude='.next' \
         --exclude='logs' \
         --exclude='.env' \
         "$REPO_DIR/" "$RELEASE_DIR/"

# Copy environment file
print_step "Copying environment configuration..."
if [ -f "$REPO_DIR/.env" ]; then
    cp "$REPO_DIR/.env" "$RELEASE_DIR/.env"
    print_success "Environment file copied"
else
    print_warning "No .env file found in $REPO_DIR"
fi

# Install dependencies
print_step "Installing dependencies..."
cd "$RELEASE_DIR"
npm ci --production=false

# Build the application
print_step "Building Next.js application..."
npm run build

if [ ! -d "$RELEASE_DIR/.next" ]; then
    print_error "Build failed - .next directory not created"
    exit 1
fi

print_success "Build completed successfully"

# Create/update symlink
print_step "Updating current release symlink..."
if [ -L "$CURRENT_LINK" ]; then
    OLD_RELEASE=$(readlink "$CURRENT_LINK")
    print_warning "Previous release: $OLD_RELEASE"
fi

# Atomic symlink swap
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
print_success "Symlink updated to new release"

# Restart PM2 processes
print_step "Restarting application with PM2..."

# Check if PM2 processes exist
if pm2 list | grep -q "$PM2_APP_NAME"; then
    print_step "Reloading Next.js app (zero-downtime)..."
    pm2 reload "$PM2_APP_NAME" --update-env
else
    print_step "Starting Next.js app for the first time..."
    cd "$CURRENT_LINK"
    pm2 start npm --name "$PM2_APP_NAME" -- start
fi

if pm2 list | grep -q "$PM2_WEBSOCKET_NAME"; then
    print_step "Restarting WebSocket server..."
    pm2 restart "$PM2_WEBSOCKET_NAME"
else
    print_step "Starting WebSocket server for the first time..."
    cd "$CURRENT_LINK"
    pm2 start npm --name "$PM2_WEBSOCKET_NAME" -- run websocket
fi

# Save PM2 configuration
pm2 save

print_success "Application restarted successfully"

# Clean up old releases
print_step "Cleaning up old releases (keeping last $KEEP_RELEASES)..."
cd "$RELEASES_DIR"
ls -t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
print_success "Old releases cleaned up"

# Display deployment summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Deployment Summary                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Release:${NC}        $RELEASE_NAME"
echo -e "  ${GREEN}Location:${NC}       $RELEASE_DIR"
echo -e "  ${GREEN}Old Commit:${NC}     $OLD_COMMIT"
echo -e "  ${GREEN}New Commit:${NC}     $NEW_COMMIT"
echo -e "  ${GREEN}Current Link:${NC}   $CURRENT_LINK -> $RELEASE_DIR"
echo ""

# Check PM2 status
print_step "Current PM2 status:"
pm2 list

echo ""
print_success "Deployment completed successfully! 🎉"
echo ""
echo -e "${YELLOW}Note: Users may need to hard refresh (Ctrl+Shift+R) to see changes${NC}"
echo ""

# Optional: Send notification (uncomment if you have a notification system)
# curl -X POST https://your-notification-webhook.com \
#   -H "Content-Type: application/json" \
#   -d "{\"text\": \"Deployment $RELEASE_NAME completed successfully\"}"

exit 0

