import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { AuthProvider } from "react-oidc-context"
import { QueryClientProvider } from "@tanstack/react-query"

import { ForceLightMode } from "@/components/layout/force-light-mode"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast"
import { AdminPageNavigator } from "@/components/auth/admin-page-navigator"
import { queryClient } from "@/lib/query-client"
import { router } from "@/router.tsx"
import { oidcConfig } from "@/auth-config.ts"

import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <ForceLightMode>
            <ToastProvider>
              <AnchoredToastProvider>
                <RouterProvider router={router} />
                <AdminPageNavigator />
              </AnchoredToastProvider>
            </ToastProvider>
          </ForceLightMode>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>
)

