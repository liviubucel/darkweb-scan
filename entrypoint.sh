#!/bin/bash
echo "Starting Tor..."
tor &
sleep 15

echo "Starting ZebraByte: AI-Powered Dark Web OSINT Tool..."
exec python main.py "$@"