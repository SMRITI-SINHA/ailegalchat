# Secure Token Handshake — chakshi.in ↔ AI Hub

## The Problem (Current)

```
AIHub.jsx (chakshi.in)
  → <iframe src="https://hub.domain/?token=eyJhbG..." />
                                       ^^^^^^^^^^^^^^^^^^
                                       JWT in URL = bad
```

| Where it leaks | Why it matters |
|---|---|
| Server access logs | Every nginx/apache/CloudFront log captures the full URL |
| Browser history | User's history contains the raw JWT |
| `Referer` header | Any third-party resource (analytics, fonts, CDN) the iframe loads receives the JWT in the Referer header |
| Shared clipboard / screenshots | URL is visible and copyable |

---

## The Fix — postMessage Handshake

Token is sent **in memory only**, never in the URL.

```
chakshi.in (parent)          AI Hub iframe
     |                            |
     |  <iframe src="https://hub.domain/hub">   (no token in URL)
     |──────────────────────────>|
     |                           | loads, then:
     |  { type: "CHAKSHI_HUB_READY" }
     |<──────────────────────────|
     |                           |
     |  { type: "CHAKSHI_TOKEN", token: jwt }
     |──────────────────────────>|  (via postMessage, never hits a URL)
     |                           |
     |                    stores in memory
     |                    attaches as Bearer header on every API call
```

---

## Changes Required

### Side 1: AI Hub (already done in this repo)

`client/src/lib/queryClient.ts` already:
- Emits `{ type: "CHAKSHI_HUB_READY" }` to `window.parent` when loaded
- Listens for `{ type: "CHAKSHI_TOKEN", token }` via postMessage
- Validates `event.origin` against `VITE_TRUSTED_PARENT_ORIGINS`
- Strips token from URL if `VITE_ALLOW_URL_TOKEN=true` (dev only)

**Environment variables to set on the AI Hub deployment:**

```env
# Comma-separated list of allowed parent origins that can send the token.
# Set to your exact production domain(s). No trailing slashes.
VITE_TRUSTED_PARENT_ORIGINS=https://chakshi.in,https://www.chakshi.in

# Set to "true" ONLY in local development so ?token= URL param works.
# Must be unset or "false" in production.
VITE_ALLOW_URL_TOKEN=false
```

---

### Side 2: chakshi.in — AIHub.jsx (dev needs to change this)

#### Before (insecure)
```jsx
function AIHub({ session }) {
  return (
    <iframe
      src={`https://hub.domain/hub?token=${session.access_token}`}
      allow="microphone"
    />
  );
}
```

#### After (secure)
```jsx
import { useRef, useEffect } from "react";

const HUB_ORIGIN = "https://hub.domain"; // exact origin of the AI Hub, no trailing slash

function AIHub({ session }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    // Listen for the hub's ready signal
    function handleMessage(event) {
      // Only accept messages from the hub origin
      if (event.origin !== HUB_ORIGIN) return;

      if (event.data?.type === "CHAKSHI_HUB_READY") {
        // Hub is ready — send the token securely
        iframeRef.current?.contentWindow?.postMessage(
          { type: "CHAKSHI_TOKEN", token: session.access_token },
          HUB_ORIGIN  // ← targetOrigin: ensures only our hub receives this, never "*"
        );
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [session.access_token]);

  return (
    <iframe
      ref={iframeRef}
      src={`${HUB_ORIGIN}/hub`}   // ← no token in URL
      allow="microphone"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}
```

---

### Side 3: chakshi-server — auth.js (optional hardening)

The current `?token=` query param support in `chakshi-server/src/middleware/auth.js` can stay for now since tokens are now sent as `Authorization: Bearer` headers (not URL params). But it is good hygiene to disable URL param token acceptance in production:

```js
// auth.js — recommended change
function extractToken(req) {
  // 1. Authorization header (always preferred)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. ?token= query param — only in development
  if (process.env.NODE_ENV !== "production" && req.query.token) {
    return req.query.token;
  }

  return null;
}
```

This means in production, tokens can only arrive via the `Authorization: Bearer` header — which is what the AI Hub sends on every API call.

---

## Token Refresh Handling

Supabase JWTs expire (default 1 hour). The parent needs to re-send when the session refreshes:

```jsx
// In AIHub.jsx — watch for session changes
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.access_token) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "CHAKSHI_TOKEN", token: session.access_token },
          HUB_ORIGIN
        );
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

---

## Security Properties After This Fix

| Property | Before | After |
|---|---|---|
| Token in server logs | Yes | No |
| Token in browser history | Yes | No |
| Token in Referer header | Yes | No |
| Token interceptable by proxy | Yes | No |
| Origin validation | None | `event.origin === HUB_ORIGIN` |
| targetOrigin protection | N/A | `HUB_ORIGIN` (not `"*"`) |
| Backend JWT signature check | Yes | Yes (unchanged) |
| Token in memory only | No | Yes |
