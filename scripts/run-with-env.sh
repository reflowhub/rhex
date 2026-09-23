#!/bin/bash
# Load .env.local and run script

set -a
source .env.local
set +a

npx tsx "$@"
