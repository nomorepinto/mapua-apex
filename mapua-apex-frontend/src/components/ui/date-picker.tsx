"use client"

import { useEffect, useState, type ReactElement } from "react"
import type * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SelectButton } from "@/components/ui/select"
import {
  formatDisplayDate,
  getDateKey,
  parseDateKey,
} from "@/lib/date-key"
import { cn } from "@/lib/utils"

export function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "Pick a date",
  disabled = false,
  required = false,
  name,
  id,
  "aria-label": ariaLabel,
  className,
  size = "default",
  displayStyle = "short",
  modifiers,
  modifiersClassNames,
  legend,
}: {
  value: string
  onChange: (value: string) => void
  minDate?: Date | string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  "aria-label"?: string
  className?: string
  size?: "sm" | "default" | "lg"
  displayStyle?: "short" | "long"
  modifiers?: React.ComponentProps<typeof Calendar>["modifiers"]
  modifiersClassNames?: React.ComponentProps<typeof Calendar>["modifiersClassNames"]
  legend?: React.ReactNode
}): ReactElement {
  const selected = value ? parseDateKey(value) : undefined
  const minimum =
    typeof minDate === "string" ? parseDateKey(minDate) : minDate
  const minDateKey = minimum ? getDateKey(minimum) : undefined
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(
    () => selected ?? minimum ?? new Date()
  )

  useEffect(() => {
    const next = parseDateKey(value)
    if (next) setMonth(next)
  }, [value])

  const handleSelect = (next: Date | undefined) => {
    if (!next) return
    onChange(getDateKey(next))
    setOpen(false)
  }

  return (
    <div className="w-full">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-required={required || undefined}
          render={
            <SelectButton
              className={cn("w-full min-w-0 bg-background", className)}
              size={size}
            />
          }
        >
          <span className="inline-flex items-center gap-2">
            <CalendarIcon />
            {selected ? (
              formatDisplayDate(selected, displayStyle)
            ) : (
              <span className="text-muted-foreground/72">{placeholder}</span>
            )}
          </span>
        </PopoverTrigger>
        <PopoverPopup align="start" className="w-auto">
          <div className="flex flex-col gap-2">
            {legend ? (
              <div className="px-1 pt-1 text-xs leading-none">{legend}</div>
            ) : null}
            <Calendar
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              disabled={
                minDateKey
                  ? (date) => getDateKey(date) < minDateKey
                  : undefined
              }
            />
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  )
}
