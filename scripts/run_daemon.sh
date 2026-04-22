#!/bin/bash
export BU_CDP_WS="ws://127.0.0.1:9222"
cd /home/ubuntu/.openclaw/browser-harness
python3 daemon.py
