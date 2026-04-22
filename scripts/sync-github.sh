#!/bin/bash
set -e

GITHUB_REPO="${GITHUB_REPO:-SMRITI-SINHA/ailegalchat}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

if [ -z "$GITHUB_PAT" ]; then
  echo "GITHUB_PAT secret not set — skipping GitHub sync"
  exit 0
fi

# Use GIT_ASKPASS so the token is never embedded in the remote URL or
# visible in process listings / shell history.
ASKPASS_SCRIPT="$(mktemp)"
cat > "$ASKPASS_SCRIPT" <<'EOF'
#!/bin/sh
case "$1" in
  Username*) echo "x-token-auth" ;;
  Password*) echo "$GITHUB_PAT" ;;
esac
EOF
chmod +x "$ASKPASS_SCRIPT"

cleanup() {
  rm -f "$ASKPASS_SCRIPT"
}
trap cleanup EXIT

echo "Syncing to GitHub (${GITHUB_REPO}@${GITHUB_BRANCH})..."
# -c credential.helper= disables any global/system credential helper so no
# token is cached outside this process.
# GIT_TERMINAL_PROMPT=0 prevents git from falling back to an interactive prompt
# if the askpass helper fails (which would hang in CI/automation).
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$ASKPASS_SCRIPT" \
  git -c credential.helper= push \
  "https://github.com/${GITHUB_REPO}.git" \
  "HEAD:${GITHUB_BRANCH}" \
  --force-with-lease
echo "GitHub sync complete."
