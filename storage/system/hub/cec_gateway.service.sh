#!/usr/bin/env bash
# Self-restarting service for CEC Gateway
while true; do
  bun run ~/storage/system/hub/cec_gateway.js >> ~/storage/system/logs/cec.log 2>&1
  echo "[CEC Gateway] crashed — restarting in 3s" >> ~/storage/system/logs/cec.log
  sleep 3
done
