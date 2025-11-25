#!/usr/bin/env bash

set -e

# Increase Node.js memory limit for build process
export NODE_OPTIONS="--max-old-space-size=4096"

exec mastra build
