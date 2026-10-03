import { useCallback, useState, type MouseEvent } from "react"

export function useDropdownFilter<T>(onSelect: (value: T | null) => void) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((current) => !current), [])
  const close = useCallback(() => setOpen(false), [])

  const clear = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onSelect(null)
      setOpen(false)
    },
    [onSelect]
  )

  const select = useCallback(
    (value: T) => {
      onSelect(value)
      setOpen(false)
    },
    [onSelect]
  )

  return { open, toggle, close, clear, select }
}
