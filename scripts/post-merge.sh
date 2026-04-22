#!/bin/bash
set -e
npm install
npm run db:push

# Run the GitHub sync in a subshell that won't abort the rest of post-merge
# on failure.  We capture the exit code and handle it ourselves.
set +e
bash scripts/sync-github.sh
SYNC_EXIT=$?
set -e

if [ "$SYNC_EXIT" -ne 0 ]; then
  echo "WARNING: GitHub sync failed (exit code $SYNC_EXIT). The mirror may be out of date."

  # Send a Slack notification when a webhook URL is configured.
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    PAYLOAD="{\"text\":\"⚠️ *GitHub sync failed* (exit code $SYNC_EXIT). The mirror of \`${GITHUB_REPO:-unknown}\` may be out of date. Check the post-merge logs for details.\"}"
    curl -s -o /dev/null -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      --data "$PAYLOAD" \
      && echo "Slack notification sent." \
      || echo "WARNING: Could not send Slack notification."
  fi
fi
