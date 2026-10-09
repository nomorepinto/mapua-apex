import { FieldWarning } from "@/components/forms/field-warning"
import { EventTimeFields } from "@/components/submission/event-time-fields"
import { CAMPUSES, VENUES } from "@/components/submission/constants"
import {
  clockFromDraft,
  combineEventTime,
  format24,
  splitEventTime,
  withHour,
  withPeriod,
  type ClockParts,
} from "@/components/submission/event-time"
import type { SaafDraft } from "@/components/submission/types"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  minEventDateKey,
  parseDateKey,
} from "@/lib/date-key"
import {
  blockNonDecimalKeys,
  blockNonIntegerKeys,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import { cn } from "@/lib/utils"

type DetailsFields = Pick<
  SaafDraft,
  | "activityTitle"
  | "activityDescription"
  | "activityObjectives"
  | "activityVenue"
  | "dateOfEvent"
  | "timeOfEvent"
  | "expectedParticipants"
  | "individualContribution"
  | "proposedBudget"
> & {
  endDateOfEvent?: string
  timeOfEventStart?: string
  timeOfEventEnd?: string
  timeOfEventStartHour?: string
  timeOfEventStartMinute?: string
  timeOfEventStartPeriod?: string
  timeOfEventEndHour?: string
  timeOfEventEndMinute?: string
  timeOfEventEndPeriod?: string
  proponents?: Array<{ dateOfSubmission?: string }>
}

const MIN_EXPECTED_PARTICIPANTS = 30
const MAX_EXPECTED_PARTICIPANTS = 3000
const MAX_INDIVIDUAL_CONTRIBUTION = 5000

export function ActivityDetailsSection({
  values,
  onChange,
  includeReservation = false,
}: {
  values: DetailsFields
  onChange: <K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) => void
  includeReservation?: boolean
}) {
  const minStartDate = minEventDateKey()
  const minEndDate =
    values.dateOfEvent && values.dateOfEvent > minStartDate
      ? values.dateOfEvent
      : minStartDate

  const handleStartDateChange = (startVal: string) => {
    onChange("dateOfEvent", startVal)
    if (!values.endDateOfEvent || values.endDateOfEvent < startVal) {
      onChange("endDateOfEvent", startVal)
    }
    const weekday = parseDateKey(startVal)?.toLocaleDateString("en-US", {
      weekday: "long",
    })
    if (weekday) onChange("dayOfEvent", weekday)
  }

  const storedTimes = splitEventTime(values.timeOfEvent || "")
  const startParts = clockFromDraft(
    values.timeOfEventStartHour,
    values.timeOfEventStartMinute,
    values.timeOfEventStartPeriod,
    values.timeOfEventStart || storedTimes.start
  )
  const endParts = clockFromDraft(
    values.timeOfEventEndHour,
    values.timeOfEventEndMinute,
    values.timeOfEventEndPeriod,
    values.timeOfEventEnd || storedTimes.end
  )

  const commitTimes = (start: ClockParts, end: ClockParts) => {
    const start24 = format24(start)
    const end24 = format24(end)
    onChange("timeOfEventStartHour", start.hour)
    onChange("timeOfEventStartMinute", start.minute)
    onChange("timeOfEventStartPeriod", start.period)
    onChange("timeOfEventEndHour", end.hour)
    onChange("timeOfEventEndMinute", end.minute)
    onChange("timeOfEventEndPeriod", end.period)
    onChange("timeOfEventStart", start24)
    onChange("timeOfEventEnd", end24)
    onChange("timeOfEvent", combineEventTime(start24, end24))
  }

  const updateStart = (next: ClockParts) => {
    commitTimes(next, endParts)
  }

  const updateEnd = (next: ClockParts) => {
    commitTimes(startParts, next)
  }

  // Reserving facilities books a physical room, so "Online" is not a valid venue
  // in that flow: it lends out no rooms, which would leave the CDM room catalog
  // empty and block every room row. Without a reservation, "Online" stays an
  // option. See the matching guard in `useSaafForm` that clears a stale value.
  const venueOptions = includeReservation ? CAMPUSES : VENUES

  return (
    <div className="space-y-6 pt-4">
      <div className="border-b border-neutral-200 pb-2">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          Details of activity
        </h2>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-neutral-800">
              Title of Activity applied for{" "}
              <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              {values.activityTitle.length}/100
            </span>
          </div>
          <Input
            name="activityTitle"
            value={values.activityTitle}
            disabled
            readOnly
            tabIndex={-1}
            placeholder="i.e. Seminar, Field Trip, Plant Visit, Outing, Socials, Assembly, Meeting, etc."
            style={{ color: "#171717" }}
            className="h-10 cursor-not-allowed rounded-lg border-neutral-300 bg-neutral-100/70 text-sm !text-neutral-900 select-none placeholder:text-neutral-400"
          />
          <input
            type="hidden"
            name="activityTitle"
            value={values.activityTitle}
          />
          <FieldWarning name="activityTitle" />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-neutral-800">
              Description <span className="text-red-500">*</span>
            </label>
            <span className={`text-[11px] ${values.activityDescription.length < 100 ? "text-amber-600 font-medium" : "text-neutral-400"}`}>
              {values.activityDescription.length}/100 min
            </span>
          </div>
          <Textarea
            name="activityDescription"
            value={values.activityDescription}
            minLength={100}
            onChange={(e) => onChange("activityDescription", e.target.value)}
            placeholder="Provide a comprehensive summary of the activity (minimum 100 characters required)..."
            rows={4}
            style={{ color: "#171717" }}
            className="min-h-24 rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <FieldWarning name="activityDescription" />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-neutral-800">
              Objectives of the Activity <span className="text-red-500">*</span>
            </label>
            <span className={`text-[11px] ${values.activityObjectives.length < 50 ? "text-amber-600 font-medium" : "text-neutral-400"}`}>
              {values.activityObjectives.length}/50 min
            </span>
          </div>
          <Textarea
            name="activityObjectives"
            value={values.activityObjectives}
            minLength={50}
            onChange={(e) => onChange("activityObjectives", e.target.value)}
            placeholder="State the primary targets and outcomes (minimum 50 characters required)..."
            rows={4}
            style={{ color: "#171717" }}
            className="min-h-24 rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <FieldWarning name="activityObjectives" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-800">
            Venue <span className="text-red-500">*</span>
          </label>
          <Select
            value={values.activityVenue || null}
            onValueChange={(value: string | null) =>
              onChange("activityVenue", value ?? "")
            }
          >
            <SelectTrigger
              aria-label="Venue"
              className={cn(
                "h-10 w-full truncate rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900",
                !values.activityVenue && "saaf-glow-invalid"
              )}
            >
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectPopup>
              {venueOptions.map((venue) => (
                <SelectItem key={venue} value={venue}>
                  {venue}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <input
            type="hidden"
            name="activityVenue"
            value={values.activityVenue}
            required
          />
          <FieldWarning name="activityVenue" />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Start Date of Event <span className="text-red-500">*</span>
            </label>
            <DatePicker
              name="dateOfEvent"
              value={values.dateOfEvent}
              minDate={minStartDate}
              onChange={handleStartDateChange}
              placeholder="Pick start date"
              aria-label="Start date of event"
              required
            />
            <span className="block text-[10px] text-neutral-500">
              At least 10 days from today
            </span>
            <FieldWarning name="dateOfEvent" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              End Date of Event <span className="text-red-500">*</span>
            </label>
            <DatePicker
              name="endDateOfEvent"
              value={values.endDateOfEvent || values.dateOfEvent || ""}
              minDate={minEndDate}
              onChange={(next) => onChange("endDateOfEvent", next)}
              placeholder="Pick end date"
              aria-label="End date of event"
              required
            />
            <FieldWarning name="endDateOfEvent" />
          </div>

        </div>

        <EventTimeFields
          start={startParts}
          end={endParts}
          onStartHour={(hour) => updateStart(withHour(startParts, hour))}
          onStartMinute={(minute) => updateStart({ ...startParts, minute })}
          onStartPeriod={(period) => updateStart(withPeriod(startParts, period))}
          onEndHour={(hour) => updateEnd(withHour(endParts, hour))}
          onEndMinute={(minute) => updateEnd({ ...endParts, minute })}
          onEndPeriod={(period) => updateEnd(withPeriod(endParts, period))}
        />
        <FieldWarning name="timeOfEvent" />
        <input type="hidden" name="timeOfEventStart" value={format24(startParts)} required />
        <input type="hidden" name="timeOfEventEnd" value={format24(endParts)} required />
        <input
          type="hidden"
          name="timeOfEvent"
          value={combineEventTime(format24(startParts), format24(endParts))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Number of Expected Participants{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="expectedParticipants"
              placeholder="30"
              min={MIN_EXPECTED_PARTICIPANTS}
              max={MAX_EXPECTED_PARTICIPANTS}
              maxLength={4}
              value={values.expectedParticipants}
              onKeyDown={blockNonIntegerKeys}
              onChange={(e) => {
                const sanitized = sanitizeIntegerInput(e.target.value)
                if (!sanitized) {
                  onChange("expectedParticipants", "")
                  return
                }
                const num = Number(sanitized)
                if (num > MAX_EXPECTED_PARTICIPANTS) {
                  onChange("expectedParticipants", String(MAX_EXPECTED_PARTICIPANTS))
                } else {
                  onChange("expectedParticipants", sanitized.slice(0, 4))
                }
              }}
              onBlur={(e) => {
                const sanitized = sanitizeIntegerInput(e.target.value)
                if (!sanitized) return
                const num = Number(sanitized)
                if (num < MIN_EXPECTED_PARTICIPANTS) {
                  onChange("expectedParticipants", String(MIN_EXPECTED_PARTICIPANTS))
                }
              }}
              style={{ color: "#171717" }}
              className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white text-center !text-neutral-900 placeholder:text-neutral-400"
              required
            />
            <FieldWarning name="expectedParticipants" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Amount of Individual Contribution{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              name="individualContribution"
              placeholder="0.00"
              maxLength={4}
              max={MAX_INDIVIDUAL_CONTRIBUTION}
              value={values.individualContribution}
              onKeyDown={blockNonDecimalKeys}
              onChange={(e) => {
                const sanitized = sanitizeIntegerInput(e.target.value)
                if (!sanitized) {
                  onChange("individualContribution", "")
                  return
                }
                const num = Number(sanitized)
                if (num > MAX_INDIVIDUAL_CONTRIBUTION) {
                  onChange("individualContribution", String(MAX_INDIVIDUAL_CONTRIBUTION))
                } else {
                  onChange("individualContribution", sanitized.slice(0, 4))
                }
              }}
              style={{ color: "#171717" }}
              className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white text-center !text-neutral-900 placeholder:text-neutral-400"
              required
            />
            <FieldWarning name="individualContribution" />
          </div>
        </div>
      </div>
    </div>
  )
}