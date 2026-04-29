import { QueryClient, QueryFunction } from "@tanstack/react-query";

// --- Token Management ---
// When Chakshi AI Hub is embedded as an iframe inside chakshi.in or chakshi.com,
// the parent app passes the Supabase JWT token as a ?token= URL query parameter.
// We read it once on load, store it in sessionStorage for SPA navigation persistence,
// and attach it to every API request as an Authorization: Bearer header.

function initToken(): string | null {
  // 1. Try URL param first (set by parent iframe embed)
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    sessionStorage.setItem("chakshi_token", urlToken);
    return urlToken;
  }
  // 2. Fall back to sessionStorage (persists across SPA route changes)
  return sessionStorage.getItem("chakshi_token");
}

let _token: string | null = initToken();

// Also listen for postMessage from parent window (alternative secure delivery)
window.addEventListener("message", (event) => {
  if (event.data && typeof event.data === "object" && event.data.type === "CHAKSHI_TOKEN") {
    const t = event.data.token;
    if (typeof t === "string" && t.length > 0) {
      _token = t;
      sessionStorage.setItem("chakshi_token", t);
    }
  }
});

export function getAuthToken(): string | null {
  return _token;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }
  return headers;
}

// --- Error handling ---

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let userMessage = res.statusText || "Something went wrong";
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
      userMessage = "Session expired or unauthorized. Please reload the page.";
    } else if (res.status === 413) {
      userMessage = "File is too large to upload. Please try a smaller file.";
    } else if (res.status === 429) {
      userMessage = "Too many requests. Please wait a moment and try again.";
    } else if (res.status >= 500) {
      userMessage = userMessage === res.statusText ? "Server error. Please try again later." : userMessage;
    }

    throw new Error(userMessage);
  }
}

// --- API request helpers ---

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
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

// Multipart upload helper (for file uploads — does NOT set Content-Type so browser sets boundary)
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
    },
    mutations: {
      retry: false,
    },
  },
});
