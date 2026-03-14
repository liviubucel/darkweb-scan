#!/bin/bash
set -e

TOR_SOCKS_HOST="${TOR_SOCKS_HOST:-127.0.0.1}"
TOR_SOCKS_PORT="${TOR_SOCKS_PORT:-9050}"
TOR_BOOTSTRAP_TIMEOUT="${TOR_BOOTSTRAP_TIMEOUT:-45}"

echo "Starting Tor..."
tor &

echo "Waiting for Tor SOCKS listener on ${TOR_SOCKS_HOST}:${TOR_SOCKS_PORT} ..."
for ((i=0; i<TOR_BOOTSTRAP_TIMEOUT; i++)); do
  if python - <<'PY'
import os
import socket
host = os.getenv("TOR_SOCKS_HOST", "127.0.0.1")
port = int(os.getenv("TOR_SOCKS_PORT", "9050"))
try:
    with socket.create_connection((host, port), timeout=1):
        raise SystemExit(0)
except OSError:
    raise SystemExit(1)
PY
  then
    echo "Tor is ready."
    break
  fi
  sleep 1
done

if ! python - <<'PY'
import os
import socket
host = os.getenv("TOR_SOCKS_HOST", "127.0.0.1")
port = int(os.getenv("TOR_SOCKS_PORT", "9050"))
try:
    with socket.create_connection((host, port), timeout=1):
        raise SystemExit(0)
except OSError:
    raise SystemExit(1)
PY
then
  echo "Warning: Tor did not become reachable before startup timeout."
fi

echo "Starting application..."
exec "$@"
