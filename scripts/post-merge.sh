#!/bin/bash
set -e
npm install
npm run db:push

bash scripts/sync-github.sh
