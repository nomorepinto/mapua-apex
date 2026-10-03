/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function applyLightTheme(disableTransitionOnChange: boolean) {
  const root = document.documentElement
  const restoreTransitions = disableTransitionOnChange
    ? disableTransitionsTemporarily()
    : null

  root.classList.remove("dark")
  root.classList.add("light")
  root.style.colorScheme = "only light"

  if (restoreTransitions) {
    restoreTransitions()
  }
}

export function ThemeProvider({
  children,
  defaultTheme: _defaultTheme = "light",
  storageKey = "theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>("light")

  const setTheme = React.useCallback(
    (_nextTheme: Theme) => {
      localStorage.setItem(storageKey, "light")
      setThemeState("light")
    },
    [storageKey]
  )

  React.useLayoutEffect(() => {
    const storedTheme = localStorage.getItem(storageKey)
    if (storedTheme !== "light") {
      localStorage.setItem(storageKey, "light")
    }
    applyLightTheme(disableTransitionOnChange)
  }, [disableTransitionOnChange, storageKey, theme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue) && event.newValue !== "light") {
        localStorage.setItem(storageKey, "light")
      }

      setThemeState("light")
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [storageKey])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [setTheme, theme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
