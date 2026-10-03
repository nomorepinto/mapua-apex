import {
  SELECT_CONTENT_STYLE,
  SELECT_ITEM_CLASS,
} from "@/components/submission/constants"
import {
  clockMinutes,
  hourChoices,
  minuteChoices,
  SAME_EVENT_TIME_MESSAGE,
  type ClockParts,
  type Period,
} from "@/components/submission/event-time"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TRIGGER_CLASS =
  "h-9.5 w-full min-w-0 truncate rounded-lg border-neutral-300 bg-white !text-neutral-900"

function ClockSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string; disabled: boolean }[]
  onChange: (value: string) => void
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next)
      }}
    >
      <SelectTrigger aria-label={label} className={TRIGGER_CLASS}>
        <SelectValue placeholder={placeholder}>
          {value || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
        style={SELECT_CONTENT_STYLE}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={SELECT_ITEM_CLASS}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TimeParts({
  group,
  parts,
  onHour,
  onMinute,
  onPeriod,
}: {
  group: string
  parts: ClockParts
  onHour: (hour: string) => void
  onMinute: (minute: string) => void
  onPeriod: (period: Period) => void
}) {
  const hours = hourChoices(parts.hour)
  const minutes = minuteChoices(parts.minute)

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <span className="block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
        {group}
      </span>
      <div className="grid grid-cols-3 gap-2">
        <ClockSelect
          label={`${group} hour`}
          value={parts.hour}
          placeholder="Hour"
          onChange={onHour}
          options={hours.map((hour) => ({
            value: hour,
            label: hour,
            disabled: false,
          }))}
        />
        <ClockSelect
          label={`${group} minute`}
          value={parts.minute}
          placeholder="Min"
          onChange={onMinute}
          options={minutes.map((minute) => ({
            value: minute,
            label: minute,
            disabled: false,
          }))}
        />
        <ClockSelect
          label={`${group} AM or PM`}
          value={parts.period}
          placeholder="AM/PM"
          onChange={(period) => {
            if (period === "AM" || period === "PM") onPeriod(period)
          }}
          options={(["AM", "PM"] as const).map((period) => ({
            value: period,
            label: period,
            disabled: false,
          }))}
        />
      </div>
    </div>
  )
}

export function EventTimeFields({
  start,
  end,
  onStartHour,
  onStartMinute,
  onStartPeriod,
  onEndHour,
  onEndMinute,
  onEndPeriod,
}: {
  start: ClockParts
  end: ClockParts
  onStartHour: (hour: string) => void
  onStartMinute: (minute: string) => void
  onEndHour: (hour: string) => void
  onEndMinute: (minute: string) => void
  onStartPeriod: (period: Period) => void
  onEndPeriod: (period: Period) => void
}) {
  const startMinutes = clockMinutes(start)
  const endMinutes = clockMinutes(end)
  const sameTime =
    startMinutes !== null && endMinutes !== null && startMinutes === endMinutes

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-neutral-800">
        Time of Event (Start to End) <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <TimeParts
          group="Start"
          parts={start}
          onHour={onStartHour}
          onMinute={onStartMinute}
          onPeriod={onStartPeriod}
        />
        <span className="text-center text-xs font-medium text-neutral-500 lg:pt-7">
          to
        </span>
        <TimeParts
          group="End"
          parts={end}
          onHour={onEndHour}
          onMinute={onEndMinute}
          onPeriod={onEndPeriod}
        />
      </div>
      <span className="block text-[10px] text-neutral-500">
        Between 7:00 AM and 9:00 PM. End time cannot be earlier than the start.
      </span>
      {sameTime ? (
        <span className="block text-[10px] font-medium text-red-600">
          {SAME_EVENT_TIME_MESSAGE}
        </span>
      ) : null}
    </div>
  )
}
