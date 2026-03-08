import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

    if (res.status === 413) {
      userMessage = "File is too large to upload. Please try a smaller file.";
    } else if (res.status === 429) {
      userMessage = "Too many requests. Please wait a moment and try again.";
    } else if (res.status >= 500) {
      userMessage = userMessage === res.statusText ? "Server error. Please try again later." : userMessage;
    }

    throw new Error(userMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
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
