import { QueryClient } from "@tanstack/react-query"

/**
 * Shared React Query client.
 *
 * Lives in its own module (not `main.tsx`) so route actions can invalidate
 * queries without importing the app root — that import previously created a
 * `main.tsx -> router.tsx -> saaf.action.ts -> main.tsx` cycle.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
