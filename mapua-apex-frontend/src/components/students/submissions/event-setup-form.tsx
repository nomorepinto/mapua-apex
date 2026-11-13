import { useState } from "react"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { useSubmissionsStart } from "@/components/students/submissions/submissions-start-context"
import { TermsConsentGate } from "@/components/submission/terms-consent-gate"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import {
  FUNDING_SOURCE_OPTIONS,
  fundingSourceLabels,
} from "@/constants/funding-sources"
import { checkGibberish, useGibberishField } from "@/hooks/use-gibberish-check"
import { cn } from "@/lib/utils"

const CAMPUS_LOCATION_ITEMS: {
  label: string
  value: "on-campus" | "off-campus"
}[] = [
  { label: "On-campus", value: "on-campus" },
  { label: "Off-campus", value: "off-campus" },
]

const FACILITY_ITEMS: { label: string; value: "yes" | "no" }[] = [
  { label: "Yes, reserve facilities / bring outside equipment", value: "yes" },
  { label: "No, neither", value: "no" },
]

const BUDGET_ITEMS: { label: string; value: "yes" | "no" }[] = [
  { label: "Yes, we will operate with a budget", value: "yes" },
  { label: "No, this activity has no budget", value: "no" },
]

export function EventSetupForm() {
  const { state, actions } = useSubmissionsStart()
  const eventNameGibberish = useGibberishField(state.eventName)
  // T&C consent gate: Continue stays disabled until the agreement is ticked.
  const [termsAccepted, setTermsAccepted] = useState(false)

  return (
    <div id="submission-start-form" className={cn(layout.stack, "w-full")}>
      <FormPageHeader
        title="Create your Activity Proposal"
        subtitle="Academic Term: 2026 - 2027 • Enter your event title, facility reservation, and budget preference"
      />

      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          // Defense-in-depth: the button is disabled until the gate reports
          // acceptance, but implicit form submission (Enter) can still fire
          // onSubmit.
          if (!termsAccepted) return
          // Submit-time pass so the gate holds even when the field was never
          // blurred; shares the session cache with the on-blur check.
          if ((await checkGibberish(state.eventName)) === "gibberish") {
            eventNameGibberish.check(state.eventName)
            return
          }
          actions.submit(event)
        }}
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
            onChange={(event) => {
              eventNameGibberish.reset()
              actions.changeEventName(event.target.value)
            }}
            onBlur={eventNameGibberish.onBlur}
            className={cn(
              Boolean(state.error) && "!border-red-500 focus-visible:!ring-red-500"
            )}
          />
          {eventNameGibberish.indicator}
          {state.error ? (
            <p className="mt-1.5 text-sm font-normal text-red-600">
              {state.error}
            </p>
          ) : null}
        </Field>

        <Field className="w-full">
          <FieldLabel htmlFor="campusLocation">
            Where will the event be held? <span className="text-red-500">*</span>
          </FieldLabel>
          <Select
            items={CAMPUS_LOCATION_ITEMS}
            itemToStringValue={(item) => item.value}
            name="campusLocation"
            value={
              CAMPUS_LOCATION_ITEMS.find(
                (item) => item.value === state.campusLocation
              ) ?? null
            }
            onValueChange={(item) =>
              actions.changeCampusLocation(item?.value ?? "")
            }
          >
            <SelectTrigger
              id="campusLocation"
              className="w-full border-neutral-200 bg-white text-neutral-900"
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectPopup className="bg-white text-neutral-900">
              {CAMPUS_LOCATION_ITEMS.map((item) => (
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

        <Field className="w-full">
          <FieldLabel htmlFor="reserveFacilities">
            Are you going to reserve school facilities/bring outside equipment? <span className="text-red-500">*</span>
          </FieldLabel>
          <Select
            items={FACILITY_ITEMS}
            itemToStringValue={(item) => item.value}
            name="reserveFacilities"
            disabled={state.campusLocation === "off-campus"}
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
          {state.campusLocation === "off-campus" ? (
            <FieldDescription>
              Off-campus events cannot reserve school facilities or bring
              outside equipment, so this is set to &quot;No, neither&quot;.
            </FieldDescription>
          ) : null}
        </Field>

        <Field className="w-full">
          <FieldLabel htmlFor="withBudget">
            Will you be operating with a budget? <span className="text-red-500">*</span>
          </FieldLabel>
          <Select
            items={BUDGET_ITEMS}
            itemToStringValue={(item) => item.value}
            name="withBudget"
            value={
              BUDGET_ITEMS.find(
                (item) => item.value === state.withBudget
              ) ?? null
            }
            onValueChange={(item) =>
              actions.changeWithBudget(item?.value ?? "")
            }
          >
            <SelectTrigger
              id="withBudget"
              className="w-full border-neutral-200 bg-white text-neutral-900"
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectPopup className="bg-white text-neutral-900">
              {BUDGET_ITEMS.map((item) => (
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

        {state.withBudget === "yes" && (
          <Field className="w-full">
            <FieldLabel htmlFor="fundingSources">
              How will this activity be funded? <span className="text-red-500">*</span>
            </FieldLabel>
            <Select
              multiple
              name="fundingSources"
              value={state.fundingSources}
              onValueChange={(next) =>
                actions.changeFundingSources(next as string[])
              }
            >
              <SelectTrigger
                id="fundingSources"
                className={cn(
                  "w-full border-neutral-200 bg-white text-neutral-900",
                  Boolean(state.error) &&
                    "!border-red-500 focus-visible:!ring-red-500"
                )}
              >
                <SelectValue>
                  {(selected: string[]) =>
                    fundingSourceLabels(selected).join(", ") ||
                    "Select funding sources"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup
                alignItemWithTrigger={false}
                className="bg-white text-neutral-900"
              >
                {FUNDING_SOURCE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-neutral-900 data-highlighted:bg-neutral-100 data-highlighted:text-neutral-900"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldDescription>Select all that apply.</FieldDescription>
          </Field>
        )}

        {/* Terms & Conditions consent gate blocking Continue until accepted */}
        <div className="pt-2">
          <TermsConsentGate onAcceptedChange={setTermsAccepted} />
        </div>

        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={!termsAccepted}
            className="min-w-40 sm:min-w-48"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  )
}