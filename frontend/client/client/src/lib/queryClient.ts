import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// API Base URL configuration
// In development with Flask backend, set VITE_API_BASE_URL=http://localhost:8080
// In production, leave empty for relative URLs
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = API_BASE_URL + url;
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
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
    // Normalize path from queryKey
    let path: string;
    if (queryKey.length === 1) {
      // Single string: use as-is (supports query params), ensure leading slash
      path = queryKey[0] as string;
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
    } else {
      // Multiple segments: trim slashes, join, and ensure leading slash
      const segments = queryKey.map(seg => String(seg).replace(/^\/+|\/+$/g, ''));
      path = '/' + segments.join('/');
    }
    
    // Strip trailing slashes from API_BASE_URL and concatenate
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = baseUrl + path;
    const res = await fetch(url);

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
