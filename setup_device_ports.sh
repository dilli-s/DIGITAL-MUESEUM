#!/usr/bin/env bash

# ==============================================================================
# DIGITAL MUSEUM — ADB Reverse Port Forwarding & Service Gateway
# ==============================================================================

# ANSI Color Palette
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Foreground Colors
CYAN='\033[38;5;51m'
GOLD='\033[38;5;220m'
AMBER='\033[38;5;214m'
EMERALD='\033[38;5;48m'
RED='\033[38;5;203m'
PURPLE='\033[38;5;141m'
BLUE='\033[38;5;75m'
GRAY='\033[38;5;244m'
WHITE='\033[38;5;255m'

# Badges & Indicators
TAG_OK="${EMERALD}${BOLD}● ONLINE ${RESET}"
TAG_ERR="${RED}${BOLD}○ OFFLINE${RESET}"
TAG_FWD="${CYAN}${BOLD}⚡ FORWARDED${RESET}"
CHECK="${EMERALD}✔${RESET}"
CROSS="${RED}✖${RESET}"
INFO="${BLUE}ℹ${RESET}"
WARN="${AMBER}▲${RESET}"

echo ""
echo -e "${GOLD}╭────────────────────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${GOLD}│${RESET}   ${GOLD}${BOLD}🏛️   D I G I T A L   M U S E U M${RESET}                                        ${GOLD}│${RESET}"
echo -e "${GOLD}│${RESET}   ${WHITE}ADB Reverse Proxy & Service Gateway Matrix${RESET}                           ${GOLD}│${RESET}"
echo -e "${GOLD}╰────────────────────────────────────────────────────────────────────────────╯${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 1. Device Discovery
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}┌── 📱 Android Device Discovery${RESET}"

DEVICES=$(adb devices 2>/dev/null | grep -w "device" | awk '{print $1}')
DEV_COUNT=$(echo "$DEVICES" | grep -v '^$' | wc -l)

if [ -z "$DEVICES" ]; then
    echo -e "${BLUE}│${RESET}  ${WARN}  ${AMBER}No Android devices or emulators currently detected via ADB.${RESET}"
    echo -e "${BLUE}│${RESET}     ${DIM}Connect via USB with USB Debugging enabled, or launch an Android emulator.${RESET}"
    echo -e "${BLUE}│${RESET}     ${DIM}(Ports will also auto-forward during 'flutter run' once a device attaches.)${RESET}"
else
    echo -e "${BLUE}│${RESET}  ${CHECK}  ${WHITE}Found ${BOLD}${DEV_COUNT}${RESET}${WHITE} active Android target(s):${RESET}"
    for DEV in $DEVICES; do
        MODEL=$(adb -s "$DEV" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
        [ -z "$MODEL" ] && MODEL="Generic Android Device"
        echo -e "${BLUE}│${RESET}     ${WHITE}• ${CYAN}${BOLD}$DEV${RESET} ${GRAY}($MODEL)${RESET}"
        
        # Apply Port Reversals
        adb -s "$DEV" reverse tcp:5000 tcp:5000 2>/dev/null || true
        adb -s "$DEV" reverse tcp:5001 tcp:5001 2>/dev/null || true
        adb -s "$DEV" reverse tcp:5173 tcp:5173 2>/dev/null || true
    done
fi
echo -e "${BLUE}└──${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 2. Port Forwarding Matrix
# ------------------------------------------------------------------------------
echo -e "${PURPLE}${BOLD}┌── ⚡ Port Forwarding Matrix${RESET}"
echo -e "${PURPLE}│${RESET}  ${WHITE}${BOLD}PORT   ${GRAY}│${RESET} ${WHITE}${BOLD}SERVICE${RESET}                  ${GRAY}│${RESET} ${WHITE}${BOLD}DESCRIPTION${RESET}"
echo -e "${PURPLE}│${RESET}  ${GRAY}───────┼──────────────────────────┼──────────────────────────────────────${RESET}"
echo -e "${PURPLE}│${RESET}  ${CYAN}5000${RESET}   ${GRAY}│${RESET} ${WHITE}Flask Backend Core API   ${GRAY}│${RESET} ${GRAY}Artifacts, Auth, Voice & AI Curator${RESET}"
echo -e "${PURPLE}│${RESET}  ${CYAN}5001${RESET}   ${GRAY}│${RESET} ${WHITE}Mapping & Spatial Engine ${GRAY}│${RESET} ${GRAY}Floorplans, Graph Routing & WiFi RSSI${RESET}"
echo -e "${PURPLE}│${RESET}  ${CYAN}5173${RESET}   ${GRAY}│${RESET} ${WHITE}Vite Web Portal / Admin  ${GRAY}│${RESET} ${GRAY}Virtual Tour, 3D Viewer & CMS${RESET}"
echo -e "${PURPLE}└──${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 3. Live Host Service Health Check
# ------------------------------------------------------------------------------
echo -e "${EMERALD}${BOLD}┌── 🩺 Local Host Service Health${RESET}"

check_port() {
    local port=$1
    if nc -z 127.0.0.1 "$port" 2>/dev/null || timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# 5000 Backend
if check_port 5000; then
    echo -e "${EMERALD}│${RESET}  ${TAG_OK}  ${WHITE}Port 5000${RESET} ➔ ${EMERALD}Backend API is live & responding${RESET}"
else
    echo -e "${EMERALD}│${RESET}  ${TAG_ERR}  ${WHITE}Port 5000${RESET} ➔ ${RED}Backend not listening${RESET} ${DIM}(cd backend && python run.py)${RESET}"
fi

# 5001 Mapping Service
if check_port 5001; then
    echo -e "${EMERALD}│${RESET}  ${TAG_OK}  ${WHITE}Port 5001${RESET} ➔ ${EMERALD}Mapping Service is live & responding${RESET}"
else
    echo -e "${EMERALD}│${RESET}  ${TAG_ERR}  ${WHITE}Port 5001${RESET} ➔ ${RED}Mapping Service not listening${RESET} ${DIM}(cd flask-mapping-service && python run.py)${RESET}"
fi

# 5173 Frontend
if check_port 5173; then
    echo -e "${EMERALD}│${RESET}  ${TAG_OK}  ${WHITE}Port 5173${RESET} ➔ ${EMERALD}Frontend Vite Dev Server is live & responding${RESET}"
else
    echo -e "${EMERALD}│${RESET}  ${TAG_ERR}  ${WHITE}Port 5173${RESET} ➔ ${RED}Frontend not listening${RESET} ${DIM}(cd frontend && npm run dev)${RESET}"
fi
echo -e "${EMERALD}└──${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 4. Active ADB Reverse Rules
# ------------------------------------------------------------------------------
RULES=$(adb reverse --list 2>/dev/null)
if [ -n "$RULES" ]; then
    echo -e "${CYAN}${BOLD}┌── 📋 Active ADB Reverse Tunnel Rules${RESET}"
    while IFS= read -r line; do
        [ -n "$line" ] && echo -e "${CYAN}│${RESET}  ${CHECK} ${DIM}$line${RESET}"
    done <<< "$RULES"
    echo -e "${CYAN}└──${RESET}"
    echo ""
fi

# ------------------------------------------------------------------------------
# Quick Commands Footer
# ------------------------------------------------------------------------------
echo -e "${GOLD}✨ Gateway configured. Your mobile app can now reach 127.0.0.1:5000, 5001 & 5173.${RESET}"
echo ""
