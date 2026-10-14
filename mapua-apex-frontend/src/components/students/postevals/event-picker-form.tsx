import { FormPageHeader } from "@/components/forms/form-page-header"
import { usePostEvalsStart } from "@/components/students/postevals/postevals-start-context"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import { formatDisplayDate } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

/**
 * Step-1 picker: a Select of the org's passed, still-in-window events (from
 * `GET students/postevals/events`). Mirrors the SAAF `event-setup-form` layout.
 */
export function EventPickerForm() {
  const { state, actions } = usePostEvalsStart()

  const items = state.events.map((event) => ({
    label: `${event.event_title || "Untitled event"} · ${formatDisplayDate(
      event.date_of_event
    )}`,
    value: event.event_id,
  }))
  const selected =
    items.find((item) => item.value === state.selectedEventId) ?? null
  const hasEvents = items.length > 0

  return (
    <div id="posteval-start-form" className={cn(layout.stack, "w-full")}>
      <FormPageHeader
        title="File a Post-Evaluation"
        subtitle="Pick a passed event that is still within its 3-day post-evaluation window."
      />

      <form
        noValidate
        onSubmit={actions.submit}
        className={cn(layout.section, "space-y-6")}
      >
        {state.isLoading ? (
          <p className="text-sm text-neutral-600">Loading eligible events…</p>
        ) : state.loadError ? (
          <p className="text-sm font-medium text-red-600">
            We couldn't load your events. Please try again.
          </p>
        ) : !hasEvents ? (
          <div className={layout.empty}>
            <p className="text-sm font-medium text-neutral-700">
              No events are eligible for a post-evaluation right now.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              An event becomes eligible once it has happened and stays eligible
              for 3 days, until a post-evaluation is filed.
            </p>
          </div>
        ) : (
          <Field className="w-full">
            <FieldLabel htmlFor="postevalEvent">
              Event <span className="text-red-500">*</span>
            </FieldLabel>
            <Select
              items={items}
              itemToStringValue={(item) => item.value}
              name="postevalEvent"
              value={selected}
              onValueChange={(item) => actions.changeEvent(item?.value ?? "")}
            >
              <SelectTrigger
                id="postevalEvent"
                className={cn(
                  "w-full border-neutral-200 bg-white text-neutral-900",
                  Boolean(state.error) && "!border-red-500"
                )}
              >
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectPopup className="bg-white text-neutral-900">
                {items.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item}
                    className="text-neutral-900 data-highlighted:bg-neutral-100 data-highlighted:text-neutral-900"
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            {state.error ? (
              <p className="mt-1.5 text-sm font-normal text-red-600">
                {state.error}
              </p>
            ) : null}
          </Field>
        )}

        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={!hasEvents}
            className="min-w-40 sm:min-w-48"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  )
}
