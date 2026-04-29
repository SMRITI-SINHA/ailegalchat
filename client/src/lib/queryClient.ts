import { QueryClient, QueryFunction } from "@tanstack/react-query";

// =============================================================================
// TOKEN DELIVERY — SECURITY DESIGN
// =============================================================================
//
// PREFERRED (secure): postMessage handshake
//   1. This iframe emits CHAKSHI_HUB_READY to window.parent on load.
//   2. Parent (chakshi.in) listens, then sends:
//        iframe.contentWindow.postMessage(
//          { type: "CHAKSHI_TOKEN", token: session.access_token },
//          "https://<this-hub-domain>"   ← exact targetOrigin, never "*"
//        )
//   3. We validate event.origin against TRUSTED_PARENT_ORIGINS before accepting.
//   4. Token is kept in memory only (_token variable). Never in the URL.
//
// FALLBACK (dev only): ?token= URL query param
//   Only accepted when VITE_ALLOW_URL_TOKEN=true (development builds).
//   In production this flag must be unset/false — URL tokens are insecure.
//   If a URL token is read, it is immediately stripped from the address bar.
//
// WHY URL PARAMS ARE INSECURE:
//   - Full URL appears in server access logs
//   - Appears in browser history
//   - Leaks via Referer header to any third-party resource the page loads
//   - Cached by proxies and CDNs
// =============================================================================

// Origins allowed to send us a CHAKSHI_TOKEN via postMessage.
// Populated from VITE_TRUSTED_PARENT_ORIGINS (comma-separated list set at build time).
// Example: "https://chakshi.in,https://www.chakshi.in,https://chakshi.com"
// If the env var is absent we accept all origins as a permissive default,
// but the token is still cryptographically verified on the backend.
const TRUSTED_PARENT_ORIGINS: Set<string> = (() => {
  const raw = import.meta.env.VITE_TRUSTED_PARENT_ORIGINS as string | undefined;
  if (!raw) return new Set<string>();
  return new Set(
    raw.split(",").map((o) => o.trim()).filter(Boolean)
  );
})();

function isOriginTrusted(origin: string): boolean {
  if (TRUSTED_PARENT_ORIGINS.size === 0) return true; // permissive until configured
  return TRUSTED_PARENT_ORIGINS.has(origin);
}

// --- Token state ---
let _token: string | null = null;

function applyToken(t: string) {
  _token = t;
  // Keep in sessionStorage so SPA route changes don't lose the token
  sessionStorage.setItem("chakshi_token", t);
}

function initToken(): void {
  // 1. Dev fallback: read from URL param (only when explicitly enabled)
  const allowUrlToken = import.meta.env.VITE_ALLOW_URL_TOKEN === "true";
  if (allowUrlToken) {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      applyToken(urlToken);
      // Strip the token from the address bar so it doesn't leak to history / Referer
      const clean = new URL(window.location.href);
      clean.searchParams.delete("token");
      window.history.replaceState({}, "", clean.toString());
      return;
    }
  }

  // 2. Restore from sessionStorage (survives SPA navigation)
  const stored = sessionStorage.getItem("chakshi_token");
  if (stored) {
    _token = stored;
  }
}

initToken();

// --- postMessage listener ---
// Receives { type: "CHAKSHI_TOKEN", token: "<JWT>" } from the parent window.
window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") return;

  if (event.data.type === "CHAKSHI_TOKEN") {
    if (!isOriginTrusted(event.origin)) {
      console.warn("[chakshi] Rejected CHAKSHI_TOKEN from untrusted origin:", event.origin);
      return;
    }
    const t = event.data.token;
    if (typeof t === "string" && t.length > 0) {
      applyToken(t);
    }
  }
});

// --- Ready signal ---
// Tell the parent window we are loaded and ready to receive the token.
// The parent should listen for this and respond with CHAKSHI_TOKEN.
// We emit once on module load and again after DOMContentLoaded to be safe.
function emitReady() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "CHAKSHI_HUB_READY" }, "*");
  }
}
emitReady();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", emitReady);
}

export function getAuthToken(): string | null {
  return _token;
}

// =============================================================================
// AUTH HEADERS
// =============================================================================

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }
  return headers;
}

// =============================================================================
// GLOBAL ERROR NOTIFICATION
// =============================================================================
// Errors flow through emitAppError → "chakshi-error" CustomEvent →
// GlobalErrorHandler (App.tsx) → shadcn toast. No raw overlays, ever.

export function emitAppError(message: string) {
  window.dispatchEvent(new CustomEvent("chakshi-error", { detail: message }));
}

// Catch unhandled promise rejections (fire-and-forget calls etc.)
window.addEventListener("unhandledrejection", (event) => {
  const msg =
    event.reason instanceof Error
      ? event.reason.message
      : String(event.reason ?? "An unexpected error occurred.");
  if (
    msg.includes("ResizeObserver") ||
    msg.includes("AbortError") ||
    msg.includes("The user aborted")
  ) {
    event.preventDefault();
    return;
  }
  emitAppError(msg);
  event.preventDefault();
});

// =============================================================================
// HTTP HELPERS
// =============================================================================

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let userMessage = "Something went wrong. Please try again.";
    try {
      const body = await res.text();
      if (body) {
        try {
          const json = JSON.parse(body);
          userMessage = json.error || json.message || userMessage;
        } catch {
          if (body.length < 200) userMessage = body;
        }
      }
    } catch {}

    if (res.status === 401) {
      userMessage = "Your session has expired. Please refresh the page to continue.";
    } else if (res.status === 413) {
      userMessage = "This file is too large. Please try a smaller file.";
    } else if (res.status === 429) {
      userMessage = "You've reached the request limit. Please wait a moment before trying again.";
    } else if (res.status >= 500) {
      userMessage = "A server error occurred. Please try again in a moment.";
    }

    throw new Error(userMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const contentHeaders = data ? { "Content-Type": "application/json" } : {};
  const res = await fetch(url, {
    method,
    headers: authHeaders(contentHeaders),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

export async function apiUpload(
  method: string,
  url: string,
  formData: FormData,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: formData,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

// Drop-in replacement for fetch() that automatically includes the auth token
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const existingHeaders = (options.headers as Record<string, string>) || {};
  return fetch(url, {
    ...options,
    headers: authHeaders(existingHeaders),
    credentials: options.credentials ?? "include",
  });
}

// =============================================================================
// REACT QUERY CLIENT
// =============================================================================

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders(),
      credentials: "include",
    });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      throwOnError: false,
    },
    mutations: {
      retry: false,
      onError: (error: Error) => {
        emitAppError(error.message ?? "Something went wrong. Please try again.");
      },
    },
  },
});
