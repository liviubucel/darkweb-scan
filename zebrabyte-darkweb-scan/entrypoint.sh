#!/bin/bash
set -e

echo "Starting Tor..."
tor &
sleep 15

echo "Starting application..."
exec "$@"
