import { createContext, useContext, type ReactNode } from "react"

const FieldWarningsContext = createContext<Record<string, string>>({})

export function FieldWarnings({
  warnings,
  children,
}: {
  warnings: Record<string, string>
  children: ReactNode
}) {
  return (
    <FieldWarningsContext.Provider value={warnings}>
      {children}
    </FieldWarningsContext.Provider>
  )
}

export function FieldWarning({ name }: { name: string }) {
  const message = useContext(FieldWarningsContext)[name]
  if (!message) return null
  return <p className="text-xs font-medium text-red-600">{message}</p>
}
