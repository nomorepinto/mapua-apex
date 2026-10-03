import type { KeyboardEvent } from "react"

export function blockNonIntegerKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (
    ["e", "E", "+", "-", ".", ","].includes(e.key) &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    e.preventDefault()
  }
}

export function blockNonDecimalKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+", "-"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
  }
  if (e.key === "." && e.currentTarget.value.includes(".")) {
    e.preventDefault()
  }
}

export function sanitizeIntegerInput(val: string) {
  return val.replace(/\D/g, "")
}

export function sanitizeDecimalInput(val: string) {
  const clean = val.replace(/[^0-9.]/g, "")
  const parts = clean.split(".")
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean
}

export function calculateRowTotal(qty: number | string, price: number | string) {
  const q = Number(qty) || 0
  const p = Number(price) || 0
  return q * p
}

export function formatPeso(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
