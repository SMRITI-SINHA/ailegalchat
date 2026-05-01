# Secure Token Handshake — chakshi.in ↔ AI Hub

## The AI Hub URL (Replit Production)

```
https://legal-ai-chat--smritiseema1022.replit.app
```

This is the URL your dev must use everywhere below.  
It is **NOT** `https://chakshi.in` — that is your own site, not the AI Hub.

---

## Embed URLs

| What to embed | Full iframe src URL |
|---|---|
| Main AI Hub | `https://legal-ai-chat--smritiseema1022.replit.app` |
| CNR Saved Cases | `https://legal-ai-chat--smritiseema1022.replit.app/embed-cnr-cases` |

---

## How the Handshake Works

```
chakshi.in (parent page)                   AI Hub iframe
        |                                         |
        |  <iframe src="https://legal-ai-chat--smritiseema1022.replit.app">
        |─────────────────────────────────────────>|
        |                                          |  loads, then emits:
        |       { type: "CHAKSHI_HUB_READY" }      |
        |<─────────────────────────────────────────|
        |                                          |
        |  { type: "CHAKSHI_TOKEN", token: jwt }   |
        |─────────────────────────────────────────>|  (in memory, never in URL)
        |                                          |
        |                              stores token in memory
        |                              attaches as Authorization: Bearer on every API call
```

---

## AIHub.jsx — Complete Corrected File

Copy this exactly. The `HUB_ORIGIN` is pre-filled with the correct URL.

```jsx
'use client';
import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';

// The Replit deployment URL of the Chakshi AI Hub.
// Do NOT change this to chakshi.in — that is your own site, not the hub.
const HUB_ORIGIN = "https://legal-ai-chat--smritiseema1022.replit.app";

const AIHub = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Token delivery ──────────────────────────────────────────────────────────
  // Listens globally for CHAKSHI_HUB_READY from any AI Hub iframe on the page
  // (main hub AND cnr-cases embed). Responds directly to whichever iframe sent it.
  useEffect(() => {
    async function sendToken(targetWindow) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        targetWindow.postMessage(
          { type: "CHAKSHI_TOKEN", token: session.access_token },
          HUB_ORIGIN
        );
      }
    }

    function handleMessage(event) {
      if (event.origin !== HUB_ORIGIN) return;
      if (event.data?.type === "CHAKSHI_HUB_READY") {
        sendToken(event.source);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ── Token refresh (Supabase JWTs expire every hour) ─────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
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
            src="https://legal-ai-chat--smritiseema1022.replit.app"
            data-chakshi-hub="main"
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

## CNRCasesEmbed.jsx — Separate Component

Use this wherever you show saved CNR cases on chakshi.in.  
Token delivery is handled automatically by the global listener in `AIHub.jsx` above — no extra code needed.

```jsx
'use client';
import React, { useState } from 'react';

const CNRCasesEmbed = () => {
  const [key, setKey] = useState(0);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
      <iframe
        key={key}
        src="https://legal-ai-chat--smritiseema1022.replit.app/embed-cnr-cases"
        data-chakshi-hub="cnr-cases"
        title="Saved CNR Cases"
        style={{ width: '100%', height: '100%', minHeight: '500px', border: 'none' }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
};

export default CNRCasesEmbed;
```

**Important:** Both `AIHub.jsx` and `CNRCasesEmbed.jsx` must be on the same page at the same time for token refresh to work — OR include the global listener in your root layout so it runs on every page.

---

## Summary of Bugs That Were Fixed

| Bug | Old (broken) | Correct |
|---|---|---|
| `HUB_ORIGIN` pointed to wrong domain | `"https://chakshi.in"` | `"https://legal-ai-chat--smritiseema1022.replit.app"` |
| iframe `src` loaded wrong page | `src="https://chakshi.in"` (own site) | `src="https://legal-ai-chat--smritiseema1022.replit.app"` |
| Origin check always failed | Expected chakshi.in, got Replit | Now correctly expects Replit URL |
| Token never sent | Origin check blocked it | Now sends on `CHAKSHI_HUB_READY` |
| Wrong token source | `localStorage.getItem('token')` | `supabase.auth.getSession()` |
| CNR embed wrong URL | `chakshi.in/embed-cnr-cases` (404) | `legal-ai-chat--smritiseema1022.replit.app/embed-cnr-cases` |

---

## Environment Variables (already set on this Replit — no changes needed)

```env
VITE_TRUSTED_PARENT_ORIGINS=https://chakshi.in,https://www.chakshi.in
VITE_ALLOW_URL_TOKEN=false
CHAKSHI_JWT_SECRET=<already set>
```

The Replit side needs no changes. Only `AIHub.jsx` (and the new `CNRCasesEmbed.jsx`) on chakshi.in need to be updated.
