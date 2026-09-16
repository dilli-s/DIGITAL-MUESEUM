#!/usr/bin/env bash
set -e

echo "Configuring adb reverse port forwarding for connected Android devices..."
adb reverse tcp:5000 tcp:5000
adb reverse tcp:5001 tcp:5001

echo ""
echo "Active adb reverse rules:"
adb reverse --list
echo ""
echo "Ports 5000 (Backend) and 5001 (Mapping Service) are now forwarded to your Android device."
