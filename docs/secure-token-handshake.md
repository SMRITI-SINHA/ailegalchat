# Secure Token Handshake — chakshi.in ↔ AI Hub

## The AI Hub URL (Replit Production)

```
https://legal-ai-chat--smritiseema1022.replit.app
```

---

## Embed URLs

| What to embed | Full iframe src URL |
|---|---|
| Main AI Hub | `https://legal-ai-chat--smritiseema1022.replit.app` |
| CNR Saved Cases | `https://legal-ai-chat--smritiseema1022.replit.app/embed-cnr-cases` |

---

## Why They Cannot Be on the Same Page

The **AI Hub** and **CNR Saved Cases** are on **different pages** in chakshi.in:
- AI Hub → shown on the `/ai-hub` route
- CNR Saved Cases → shown on the `/cases` route (or similar)

The token listener must be **always active** regardless of which page the user is on.  
**The fix: put the listener in the root layout (`layout.tsx`), not inside `AIHub.jsx`.**

---

## Step 1 — Root Layout Listener (REQUIRED)

Add this once in your root `layout.tsx` (or `_app.tsx`).  
This runs on every page so every iframe always gets a token automatically.

```tsx
// app/layout.tsx  (or pages/_app.tsx)
'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const HUB_ORIGIN = "https://legal-ai-chat--smritiseema1022.replit.app";

export function ChakshiTokenProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function sendToken(targetWindow: Window) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        targetWindow.postMessage(
          { type: "CHAKSHI_TOKEN", token: session.access_token },
          HUB_ORIGIN
        );
      }
    }

    // Listen for any Chakshi iframe on any page saying it's ready
    function handleMessage(event: MessageEvent) {
      if (event.origin !== HUB_ORIGIN) return;
      if (event.data?.type === "CHAKSHI_HUB_READY") {
        sendToken(event.source as Window);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Refresh token whenever Supabase session renews
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          document.querySelectorAll<HTMLIFrameElement>('iframe[data-chakshi-hub]').forEach(iframe => {
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

  return <>{children}</>;
}
```

Then wrap your layout:
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ChakshiTokenProvider>
          {children}
        </ChakshiTokenProvider>
      </body>
    </html>
  );
}
```

---

## Step 2 — AIHub.jsx (simplified — listener is now in layout)

```jsx
'use client';
import React, { useState, useRef } from 'react';
import { FiRefreshCw, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';

const HUB_ORIGIN = "https://legal-ai-chat--smritiseema1022.replit.app";

const AIHub = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);

  // Belt-and-suspenders: also send token on iframe load
  // (covers the case where the ready signal was already fired before layout listener ran)
  async function handleLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        { type: "CHAKSHI_TOKEN", token: session.access_token },
        HUB_ORIGIN
      );
    }
  }

  return (
    <div
      className={`flex flex-col bg-gradient-to-br from-[#f5f5ef] to-[#f8f7f2] ${
        isFullscreen ? 'fixed inset-0 z-50' : 'fixed top-0 right-0 bottom-0'
      }`}
      style={isFullscreen ? {} : { left: '240px' }}
    >
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-gray-200 bg-white/60 backdrop-blur-sm flex-shrink-0">
        <button onClick={() => setIframeKey(p => p + 1)} className="p-1.5 rounded hover:bg-gray-100" title="Refresh">
          <FiRefreshCw size={14} />
        </button>
        <button onClick={() => setIsFullscreen(f => !f)} className="p-1.5 rounded hover:bg-gray-100" title="Toggle fullscreen">
          {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-1">
        <div className="h-full w-full rounded overflow-hidden shadow-xl">
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src="https://legal-ai-chat--smritiseema1022.replit.app"
            data-chakshi-hub="main"
            onLoad={handleLoad}
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

## Step 3 — CNRCasesEmbed.jsx (separate page, token from layout)

Put this on your Cases page. The root layout listener handles token delivery automatically.

```jsx
'use client';
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const HUB_ORIGIN = "https://legal-ai-chat--smritiseema1022.replit.app";

const CNRCasesEmbed = () => {
  const [key, setKey] = useState(0);
  const iframeRef = useRef(null);

  // Belt-and-suspenders: also send token on iframe load
  async function handleLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        { type: "CHAKSHI_TOKEN", token: session.access_token },
        HUB_ORIGIN
      );
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
      <iframe
        ref={iframeRef}
        key={key}
        src="https://legal-ai-chat--smritiseema1022.replit.app/embed-cnr-cases"
        data-chakshi-hub="cnr-cases"
        onLoad={handleLoad}
        title="Saved CNR Cases"
        style={{ width: '100%', height: '100%', minHeight: '500px', border: 'none' }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
};

export default CNRCasesEmbed;
```

---

## How Token Delivery Now Works (Three Layers)

The AI Hub now retries sending `CHAKSHI_HUB_READY` every 500ms until it gets a token — so even if Layer 1 is slow, Layers 2 and 3 catch it.

| Layer | Mechanism | Handles |
|---|---|---|
| 1 | Root layout listener responds to `CHAKSHI_HUB_READY` | Normal case |
| 2 | `onLoad` on each iframe directly sends token | Iframe loaded before listener ran |
| 3 | AI Hub retries `CHAKSHI_HUB_READY` every 500ms for 60s | Any timing race |

---

## Summary of All Changes

| What | Location |
|---|---|
| Global token listener | Root `layout.tsx` — always active on all pages |
| `AIHub.jsx` | Simplified — uses `onLoad` as backup |
| `CNRCasesEmbed.jsx` | New component for Cases page — uses `onLoad` as backup |
| AI Hub retry | `queryClient.ts` — retries every 500ms until token received |

---

## Environment Variables (already set — no changes needed)

```env
VITE_TRUSTED_PARENT_ORIGINS=https://chakshi.in,https://www.chakshi.in
VITE_ALLOW_URL_TOKEN=false
CHAKSHI_JWT_SECRET=<already set>
```
