# GitHub Push Procedure

## Overview

The project automatically syncs code to GitHub after every task merge via
`scripts/post-merge.sh` → `scripts/sync-github.sh`.

## Required Secret

| Secret name  | Where to set it           | Value                                    |
|-------------|---------------------------|------------------------------------------|
| `GITHUB_PAT` | Replit Secrets panel      | A GitHub Personal Access Token with `repo` scope |

The token is **never** stored in `.git/config` or any project file. It is
read from the environment at push time only.

## How the push works

`scripts/sync-github.sh` uses `GIT_ASKPASS` to supply credentials:

1. A temporary credential-helper script is written to a `mktemp` path.
2. `git push` is called with the plain `https://github.com/…` URL (no token
   in the URL).
3. Git calls the `GIT_ASKPASS` helper to get the username
   (`x-token-auth`) and password (`$GITHUB_PAT`).
4. The temporary helper file is removed via a `trap cleanup EXIT` handler.

This means the token never appears in:
- `.git/config` remote URLs
- shell history (no inline URL with credentials)
- process listings (`ps aux`)

## Manual push (if needed)

If you ever need to push manually, run:

```bash
GITHUB_PAT=<your-token> bash scripts/sync-github.sh
```

Or set the secret in the Replit Secrets panel and run the script directly:

```bash
bash scripts/sync-github.sh
```

## Rotating the token

1. Generate a new PAT in GitHub → Settings → Developer settings → PATs.
2. Update the `GITHUB_PAT` secret in the Replit Secrets panel.
3. Revoke the old token in GitHub.

No code changes are needed — the new token is picked up automatically on the
next sync.
