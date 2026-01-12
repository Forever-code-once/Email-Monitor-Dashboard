#!/bin/bash

###############################################################################
# Rollback Script - Quickly revert to previous release
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_DIR="/home/ubuntu"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
PM2_APP_NAME="email-monitor"
PM2_WEBSOCKET_NAME="email-websocket"

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                    ROLLBACK DEPLOYMENT                     ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check current release
if [ ! -L "$CURRENT_LINK" ]; then
    echo -e "${RED}✗ Error: No current release found${NC}"
    exit 1
fi

CURRENT_RELEASE=$(readlink "$CURRENT_LINK")
echo -e "${YELLOW}Current release: $CURRENT_RELEASE${NC}"

# List available releases
echo -e "\n${BLUE}Available releases:${NC}"
cd "$RELEASES_DIR"
ls -lt | grep '^d' | head -5 | awk '{print NR". "$9}'

# Get previous release
PREVIOUS_RELEASE=$(ls -t | grep -v "$(basename $CURRENT_RELEASE)" | head -1)

if [ -z "$PREVIOUS_RELEASE" ]; then
    echo -e "\n${RED}✗ Error: No previous release found to rollback to${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Will rollback to: $PREVIOUS_RELEASE${NC}"
echo ""
read -p "Are you sure you want to rollback? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Rollback cancelled${NC}"
    exit 1
fi

# Perform rollback
echo -e "\n${GREEN}▶ Rolling back...${NC}"

# Update symlink
ln -sfn "$RELEASES_DIR/$PREVIOUS_RELEASE" "$CURRENT_LINK"
echo -e "${GREEN}✓ Symlink updated${NC}"

# Restart PM2
echo -e "\n${GREEN}▶ Restarting application...${NC}"
pm2 reload "$PM2_APP_NAME" --update-env
pm2 restart "$PM2_WEBSOCKET_NAME"
pm2 save

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Rollback Completed Successfully!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Previous:${NC} $CURRENT_RELEASE"
echo -e "  ${GREEN}Current:${NC}  $PREVIOUS_RELEASE"
echo ""

pm2 list

exit 0

