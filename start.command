#!/bin/bash
# Double-clickable launcher for macOS (or run: ./start.command)
cd "$(dirname "$0")"
PORT="${1:-4520}"
echo "🚢 Starting ShipList on http://127.0.0.1:${PORT} ..."
( sleep 1; open "http://127.0.0.1:${PORT}" ) &
exec node server.js --port "${PORT}"
