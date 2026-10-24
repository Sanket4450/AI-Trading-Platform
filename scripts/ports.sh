#!/usr/bin/env bash
set -u

for port in 3000 8000; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null; then
    :
  else
    echo "Port $port is free"
  fi
done
