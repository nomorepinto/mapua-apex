import { useMemo } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePublicOrganizationsQuery } from "@/hooks/use-public"
import { cn } from "@/lib/utils"

interface OrganizationOption {
  label: string
  value: string
}

export function OrganizationSelect({
  disabled,
  invalid,
  onValueChange,
  value,
}: {
  disabled?: boolean
  invalid?: boolean
  onValueChange: (organizationId: string) => void
  value: string
}) {
  const organizationsQuery = usePublicOrganizationsQuery()
  const items = useMemo<OrganizationOption[]>(
    () =>
      (organizationsQuery.data ?? [])
        .filter((organization) => organization.organization_id)
        .map((organization) => ({
          label: organization.name || organization.organization_id,
          value: organization.organization_id,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [organizationsQuery.data]
  )
  const selected =
    items.find((organization) => organization.value === value) ?? null

  return (
    <Field className="space-y-1.5 text-left">
      <FieldLabel
        htmlFor="signup-organization"
        className="text-xs font-semibold text-neutral-800"
      >
        Organization
      </FieldLabel>
      {organizationsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p>Could not load the organization list.</p>
          <button
            type="button"
            onClick={() => void organizationsQuery.refetch()}
            className="mt-1 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <Select
          disabled={
            disabled || organizationsQuery.isPending || items.length === 0
          }
          itemToStringValue={(item) => item.value}
          items={items}
          name="organization"
          onValueChange={(item) => onValueChange(item?.value ?? "")}
          value={selected}
        >
          <SelectTrigger
            id="signup-organization"
            aria-invalid={invalid || undefined}
            className={cn(
              "min-h-10 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-900",
              invalid && "border-red-500"
            )}
          >
            <SelectValue
              placeholder={
                organizationsQuery.isPending
                  ? "Loading organizations..."
                  : items.length === 0
                    ? "No organizations available"
                    : "Select your organization"
              }
            />
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            {items.map((item) => (
              <SelectItem key={item.value} value={item}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      )}
    </Field>
  )
}
