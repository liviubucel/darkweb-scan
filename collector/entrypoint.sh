#!/bin/sh
set -eu

mkdir -p /run/tor
chown -R debian-tor:debian-tor /run/tor

tor --RunAsDaemon 1 \
  --User debian-tor \
  --SocksPort 127.0.0.1:9050 \
  --DataDirectory /var/lib/tor \
  --Log "notice file /var/log/tor/notices.log"

attempt=0
until grep -q "Bootstrapped 100%" /var/log/tor/notices.log 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 90 ]; then
    echo "Tor bootstrap failed" >&2
    tail -n 25 /var/log/tor/notices.log >&2 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

exec su -s /bin/sh nobody -c \
  "uvicorn collector.app:app --host 0.0.0.0 --port 8080 --workers 1 --no-access-log --proxy-headers=false"
