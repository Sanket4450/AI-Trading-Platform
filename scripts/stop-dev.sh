#!/usr/bin/env bash
set -u

# Stop local AI Trading System dev listeners without touching other ports.
# Usage: pnpm dev:stop
found=0

for port in 3000 8000; do
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [ -z "$pids" ]; then
    echo "Port $port is free"
    continue
  fi

  found=1
  echo "Port $port is held by:"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN
  echo "Stopping PID(s): $pids"
  kill $pids 2>/dev/null || true
done

if [ "$found" -eq 0 ]; then
  echo "Nothing to stop."
fi
