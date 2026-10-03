import { useLayoutEffect, type ReactNode } from "react"

import { useTheme } from "@/components/theme-provider"

/** Keep coss tokens and native controls on the light palette. */
export function ForceLightMode({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme()

  useLayoutEffect(() => {
    if (theme !== "light") {
      setTheme("light")
    }
  }, [setTheme, theme])

  return children
}
