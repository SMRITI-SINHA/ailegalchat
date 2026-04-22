#!/bin/bash
set -e

GITHUB_REPO="${GITHUB_REPO:-SMRITI-SINHA/ailegalchat}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

if [ -z "$GITHUB_PAT" ]; then
  echo "GITHUB_PAT secret not set — skipping GitHub sync"
  exit 0
fi

echo "Syncing to GitHub (${GITHUB_REPO}@${GITHUB_BRANCH})..."
git push \
  "https://x-token-auth:${GITHUB_PAT}@github.com/${GITHUB_REPO}.git" \
  "HEAD:${GITHUB_BRANCH}" \
  --force
echo "GitHub sync complete."
