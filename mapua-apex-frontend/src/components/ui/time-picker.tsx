"use client"

import { useState, type ReactElement } from "react"
import { ClockIcon } from "lucide-react"

import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete"

const TIMES = Array.from({ length: 96 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0")
  const minutes = String((i % 4) * 15).padStart(2, "0")
  return `${hours}:${minutes}`
})

function parseTime(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed)
  if (colonMatch) {
    const hours = Number(colonMatch[1])
    const minutes = Number(colonMatch[2])
    if (hours > 23 || minutes > 59) return null
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }

  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 0 || digits.length > 4) return null

  let hours: number
  let minutes: number

  if (digits.length <= 2) {
    hours = Number(digits)
    minutes = 0
  } else if (digits.length === 3) {
    hours = Number(digits[0])
    minutes = Number(digits.slice(1))
  } else {
    hours = Number(digits.slice(0, 2))
    minutes = Number(digits.slice(2))
  }

  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4)

  if (digits.length <= 2) return digits

  if (digits.length === 3) {
    const minutes = Number(digits.slice(1))
    if (minutes <= 59) return `${digits[0]}:${digits.slice(1)}`
    return digits
  }

  return parseTime(digits) ?? digits
}

function filterTime(item: string, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  if (item.toLowerCase().startsWith(trimmed)) return true

  const itemDigits = item.replace(/\D/g, "")
  const queryDigits = trimmed.replace(/\D/g, "")
  if (!queryDigits) return false

  const itemHour = Number(itemDigits.slice(0, 2))
  const itemMinutes = itemDigits.slice(2)
  const itemDigitsUnpadded = `${itemHour}${itemMinutes}`

  if (
    itemDigits.startsWith(queryDigits) ||
    itemDigitsUnpadded.startsWith(queryDigits)
  ) {
    return true
  }

  if (queryDigits.length >= 3) {
    return parseTime(queryDigits) === item
  }

  const queryHour = Number(queryDigits)

  if (trimmed.includes(":")) {
    const minuteQuery = trimmed.split(":")[1]?.replace(/\D/g, "") ?? ""
    return (
      itemHour === queryHour &&
      (!minuteQuery || itemMinutes.startsWith(minuteQuery))
    )
  }

  if (queryDigits.length === 1) {
    return itemHour === queryHour || String(itemHour).startsWith(queryDigits)
  }

  return queryHour <= 23 && itemHour === queryHour
}

export function TimePicker({
  value,
  onChange,
  placeholder = "HH:mm",
  disabled = false,
  required = false,
  name,
  id,
  "aria-label": ariaLabel,
  className,
  size = "default",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  "aria-label"?: string
  className?: string
  size?: "sm" | "default" | "lg"
}): ReactElement {
  const [isEditing, setIsEditing] = useState(false)

  const handleTimeChange = (nextValue: string) => {
    setIsEditing(true)
    const next = formatTimeInput(nextValue)
    onChange(next)
  }

  const handleTimeBlur = () => {
    const normalized = parseTime(value)
    onChange(normalized ?? value)
    setIsEditing(false)
  }

  return (
    <div className="w-full">
      <Autocomplete
        items={TIMES}
        value={value}
        onValueChange={handleTimeChange}
        disabled={disabled}
        openOnInputClick
        filter={(item, query) => filterTime(item, isEditing ? query : "")}
      >
        <AutocompleteInput
          id={id}
          name={name}
          required={required}
          aria-label={ariaLabel}
          placeholder={placeholder}
          size={size}
          className={className}
          startAddon={<ClockIcon />}
          onFocus={(event) => {
            setIsEditing(false)
            event.currentTarget.select()
          }}
          onBlur={handleTimeBlur}
        />
        <AutocompletePopup>
          <AutocompleteEmpty>No matching time.</AutocompleteEmpty>
          <AutocompleteList>
            {(item: string) => (
              <AutocompleteItem key={item} value={item}>
                {item}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  )
}
