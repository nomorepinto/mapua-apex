import { FormPageHeader } from "@/components/forms/form-page-header"
import { useSubmissionsStart } from "@/components/students/submissions/submissions-start-context"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const FACILITY_ITEMS: { label: string; value: "yes" | "no" }[] = [
  { label: "Yes, reserve school facilities", value: "yes" },
  { label: "No, do not reserve facilities", value: "no" },
]

export function EventSetupForm() {
  const { state, actions } = useSubmissionsStart()

  return (
    <div id="submission-start-form" className={cn(layout.stack, "w-full")}>
      <FormPageHeader
        title="Create your Activity Proposal"
        subtitle="Academic Term: 2026 - 2027 • Enter your event title and facility reservation preference"
      />

      <form
        noValidate
        onSubmit={actions.submit}
        className={cn(layout.section, "space-y-6")}
      >
        <Field className="w-full">
          <FieldLabel htmlFor="eventName">
            Event name <span className="text-red-500">*</span>
          </FieldLabel>
          <Input
            id="eventName"
            name="eventName"
            nativeInput
            placeholder="e.g. Tech Week 2026"
            maxLength={60}
            type="text"
            value={state.eventName}
            onChange={(event) => actions.changeEventName(event.target.value)}
            className={cn(
              Boolean(state.error) && "!border-red-500 focus-visible:!ring-red-500"
            )}
          />
          {state.error ? (
            <p className="mt-1.5 text-sm font-normal text-red-600">
              {state.error}
            </p>
          ) : null}
        </Field>

        <Field className="w-full">
          <FieldLabel htmlFor="reserveFacilities">
            Are you going to reserve school facilities? <span className="text-red-500">*</span>
          </FieldLabel>
          <Select
            items={FACILITY_ITEMS}
            itemToStringValue={(item) => item.value}
            name="reserveFacilities"
            value={
              FACILITY_ITEMS.find(
                (item) => item.value === state.reserveFacilities
              ) ?? null
            }
            onValueChange={(item) =>
              actions.changeReserveFacilities(item?.value ?? "")
            }
          >
            <SelectTrigger
              id="reserveFacilities"
              className="w-full border-neutral-200 bg-white text-neutral-900"
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectPopup className="bg-white text-neutral-900">
              {FACILITY_ITEMS.map((item) => (
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
        </Field>

        <div className="flex justify-center pt-2">
          <Button type="submit" className="min-w-40 sm:min-w-48">
            Continue
          </Button>
        </div>
      </form>
    </div>
  )
}