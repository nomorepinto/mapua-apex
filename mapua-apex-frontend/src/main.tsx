import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { AuthProvider } from "react-oidc-context"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ForceLightMode } from "@/components/layout/force-light-mode"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast"
import { router } from "@/router.tsx"
import { oidcConfig } from "@/auth-config.ts"

import "./index.css"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <ForceLightMode>
            <ToastProvider>
              <AnchoredToastProvider>
                <RouterProvider router={router} />
              </AnchoredToastProvider>
            </ToastProvider>
          </ForceLightMode>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>
)

