# Secure Token Handshake — chakshi.in ↔ AI Hub

## Critical: What HUB_ORIGIN Must Be

`HUB_ORIGIN` = **the Replit app URL** (where this AI Hub is deployed).  
It is **NOT** `https://chakshi.in` — that is your own domain, not the hub.

```
WRONG:  const HUB_ORIGIN = "https://chakshi.in";       ← your own site, causes infinite loop
CORRECT: const HUB_ORIGIN = "https://your-hub.replit.app"; ← the Replit deployment URL
```

**Your current Replit development URL:**
```
https://08db6339-46a6-4e1f-bd99-7431b7132adf-00-1g8n8ex0817mp.spock.replit.dev
```

When you publish/deploy this Replit app, you'll get a stable production URL like:
```
https://chakshi-hub.replit.app   (example — use your actual deployed URL)
```
Use that deployed URL as `HUB_ORIGIN` in your production `AIHub.jsx`.

---

## How the Handshake Works

```
chakshi.in (parent page)           AI Hub iframe (Replit URL)
        |                                  |
        |  <iframe src="HUB_ORIGIN/hub">   |
        |─────────────────────────────────>|
        |                                  |  loads, then emits:
        |    { type: "CHAKSHI_HUB_READY" } |
        |<─────────────────────────────────|
        |                                  |
        |  { type: "CHAKSHI_TOKEN", token }|
        |─────────────────────────────────>|  (via postMessage, never in URL)
        |                                  |
        |                       stores in memory
        |                       attaches as Authorization: Bearer on all API calls
```

---

## Corrected AIHub.jsx (replace what you have now)

This handles **both** the main AI Hub and the CNR embed iframe automatically.

```jsx
'use client';
import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';

// ─── IMPORTANT ───────────────────────────────────────────────────────────────
// HUB_ORIGIN = the Replit deployment URL of the Chakshi AI Hub.
// This is NOT your chakshi.in domain — it is the external Replit app.
// Development:  https://08db6339-46a6-4e1f-bd99-7431b7132adf-00-1g8n8ex0817mp.spock.replit.dev
// Production:   use your deployed Replit URL (e.g. https://chakshi-hub.replit.app)
// ─────────────────────────────────────────────────────────────────────────────
const HUB_ORIGIN = "https://YOUR-REPLIT-APP.replit.app"; // ← PUT YOUR REPLIT URL HERE

const AIHub = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Token delivery ──────────────────────────────────────────────────────────
  // We listen globally for CHAKSHI_HUB_READY from ANY iframe (main hub or embed
  // pages). When we hear it, we reply directly to that iframe via event.source.
  // This means both AIHub and EmbedCNRCases iframes get tokens automatically.
  useEffect(() => {
    async function sendToken(targetWindow) {
      // Use Supabase session — do NOT use localStorage.getItem('token'),
      // Supabase does not store the token under that key.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        targetWindow.postMessage(
          { type: "CHAKSHI_TOKEN", token: session.access_token },
          HUB_ORIGIN  // ← critical: targetOrigin must be the Replit URL, never "*"
        );
      }
    }

    function handleMessage(event) {
      // Only accept signals from our Replit hub — ignore all other origins
      if (event.origin !== HUB_ORIGIN) return;
      if (event.data?.type === "CHAKSHI_HUB_READY") {
        // Respond directly to whichever iframe sent the ready signal
        sendToken(event.source);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ── Token refresh (Supabase session renews every hour) ──────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          // Broadcast refreshed token to all hub iframes on the page
          document.querySelectorAll('iframe[data-chakshi-hub]').forEach(iframe => {
            iframe.contentWindow?.postMessage(
              { type: "CHAKSHI_TOKEN", token: session.access_token },
              HUB_ORIGIN
            );
          });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleRefresh = () => setIframeKey(prev => prev + 1);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <div
      className={`flex flex-col bg-gradient-to-br from-[#f5f5ef] to-[#f8f7f2] ${
        isFullscreen ? 'fixed inset-0 z-50' : 'fixed top-0 right-0 bottom-0'
      }`}
      style={isFullscreen ? {} : { left: '240px' }}
    >
      {/* Controls */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-gray-200 bg-white/60 backdrop-blur-sm flex-shrink-0">
        <button onClick={handleRefresh} className="p-1.5 rounded hover:bg-gray-100" title="Refresh">
          <FiRefreshCw size={14} />
        </button>
        <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-gray-100" title="Toggle fullscreen">
          {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
        </button>
      </div>

      {/* Main AI Hub iframe */}
      <div className="flex-1 overflow-hidden p-1">
        <div className="h-full w-full rounded overflow-hidden shadow-xl">
          <iframe
            key={iframeKey}
            src={`${HUB_ORIGIN}`}          {/* ← loads the Replit app, NOT chakshi.in */}
            data-chakshi-hub="main"         {/* ← used by token refresh above */}
            title="Chakshi AI Hub"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            loading="lazy"
            allow="microphone"
          />
        </div>
      </div>
    </div>
  );
};

export default AIHub;
```

---

## Embedding the CNR Saved Cases Page

The CNR cases embed is a **separate page** on the Replit app at `/embed-cnr-cases`.  
Embed it wherever you show saved cases — token delivery is automatic (see above).

```jsx
'use client';
import React, { useState } from 'react';

// Same HUB_ORIGIN as above — same Replit app
const HUB_ORIGIN = "https://YOUR-REPLIT-APP.replit.app"; // ← same URL as AIHub.jsx

const CNRCasesEmbed = () => {
  const [key, setKey] = useState(0);

  return (
    <iframe
      key={key}
      src={`${HUB_ORIGIN}/embed-cnr-cases`}   {/* ← /embed-cnr-cases route */}
      data-chakshi-hub="cnr-cases"              {/* ← picked up by token refresh */}
      title="Saved CNR Cases"
      className="w-full h-full border-0"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      style={{ minHeight: '500px' }}
    />
  );
};

export default CNRCasesEmbed;
```

The `AIHub.jsx` global listener handles token delivery for this iframe too — no extra code needed.

---

## Why "Refused to Connect" Happened

If you were embedding `https://chakshi.in/embed-cnr-cases` — that route doesn't exist on  
your Next.js app. The embed page only exists on the Replit app:

```
WRONG:   src="https://chakshi.in/embed-cnr-cases"       ← 404, refused to connect
CORRECT: src="https://YOUR-REPLIT-APP.replit.app/embed-cnr-cases"  ← works
```

---

## Summary of Bugs Fixed in This Doc

| Bug | Old Code | Correct Code |
|---|---|---|
| HUB_ORIGIN was wrong domain | `"https://chakshi.in"` | `"https://your-hub.replit.app"` |
| iframe src loaded wrong page | `src={HUB_ORIGIN}` → chakshi.in in itself | `src={HUB_ORIGIN}` → Replit URL |
| Origin check always failed | Checked for chakshi.in, got Replit origin | Now correctly checks Replit origin |
| Token never delivered | Check failed → postMessage never ran | Now sends on CHAKSHI_HUB_READY |
| Wrong token source | `localStorage.getItem('token')` | `supabase.auth.getSession()` |
| CNR embed wrong URL | `chakshi.in/embed-cnr-cases` (404) | `replit-url/embed-cnr-cases` |
| Token refresh missed embeds | Only sent to one ref | Broadcasts to all `data-chakshi-hub` iframes |

---

## Environment Variables (already set on this Replit)

```env
VITE_TRUSTED_PARENT_ORIGINS=https://chakshi.in,https://www.chakshi.in
VITE_ALLOW_URL_TOKEN=false
CHAKSHI_JWT_SECRET=<your Supabase JWT secret — already set>
```

No changes needed on the Replit side — only the chakshi.in `AIHub.jsx` needs updating.
