#!/bin/bash
# Start Chrome in headless mode with remote debugging enabled
# Useful for VPS environments

CHROME_BIN=$(which google-chrome || which chromium-browser || which chromium)
PORT=9222
USER_DATA_DIR="/tmp/chrome-openclaw-$(date +%s)"

echo "🚀 Starting Chrome at $CHROME_BIN on port $PORT..."
echo "📂 User data dir: $USER_DATA_DIR"

mkdir -p "$USER_DATA_DIR"

# Start Chrome in background
# --remote-debugging-port: Enable CDP
# --headless=new: Modern headless mode
# --no-sandbox: Required for many VPS/Docker environments
# --disable-gpu: Recommended for headless
# --remote-debugging-address=0.0.0.0: Allow connections from outside (optional, 127.0.0.1 is safer)

nohup "$CHROME_BIN" \
  --headless=new \
  --remote-debugging-port=$PORT \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$USER_DATA_DIR" \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --window-size=1280,900 \
  > /tmp/chrome-debug.log 2>&1 &

# Wait for it to be ready
echo "⏳ Waiting for Chrome to initialize..."
for i in {1..10}; do
  if curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null; then
    echo "✅ Chrome is ready!"
    curl -s "http://127.0.0.1:$PORT/json/version"
    exit 0
  fi
  sleep 1
done

echo "❌ Chrome failed to start in time. Check /tmp/chrome-debug.log"
exit 1
