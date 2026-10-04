import { useMemo } from "react"

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import {
  useAvailableOrganizationsQuery,
  useCurrentOrganizationQuery,
} from "@/hooks/use-submissions"
import { cn } from "@/lib/utils"

/**
 * Multi-select dropdown of dependent organizations for a collaborative
 * submission. The proponent (current) organization is excluded; selection is
 * optional — an empty selection means the submission has no collaborators.
 */
export function CollaboratorsSection({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const organizationsQuery = useAvailableOrganizationsQuery()
  const currentOrgQuery = useCurrentOrganizationQuery()

  const currentOrgId = currentOrgQuery.data?.organization_id

  const options = useMemo(() => {
    const organizations = organizationsQuery.data || []
    return organizations
      .filter((org) => org.organization_id && org.organization_id !== currentOrgId)
      .sort((left, right) =>
        (left.name || left.organization_id).localeCompare(
          right.name || right.organization_id
        )
      )
  }, [organizationsQuery.data, currentOrgId])

  const nameById = useMemo(() => {
    const names = new Map<string, string>()
    options.forEach((org) =>
      names.set(org.organization_id, org.name || org.organization_id)
    )
    return names
  }, [options])

  // Compact trigger summary for the coss multi-select render function.
  const renderValue = (selected: string[]) => {
    if (selected.length === 0) return "Select collaborating organizations"
    const first = nameById.get(selected[0] ?? "") ?? selected[0]
    return selected.length > 1 ? `${first} (+${selected.length - 1} more)` : first
  }

  return (
    <section className={cn(layout.section, "mt-4")}>
      <div className="mb-3 space-y-1">
        <h3 className="text-base font-bold text-neutral-900">
          Collaborating Organizations
        </h3>
        <p className="text-sm text-neutral-500">
          Optional. Dependent organizations receive a read-only copy of this
          application and its notifications. Only your organization can edit or
          resubmit.
        </p>
      </div>

      {organizationsQuery.isLoading ? (
        <p className="text-sm text-neutral-500">Loading organizations…</p>
      ) : organizationsQuery.isError ? (
        <p className="text-sm text-red-600">
          Could not load the organization list.
        </p>
      ) : options.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No other organizations are available to collaborate with.
        </p>
      ) : (
        <Select
          multiple
          aria-label="Collaborating organizations"
          value={value}
          onValueChange={(next) => onChange(next as string[])}
        >
          <SelectTrigger>
            <SelectValue>{renderValue}</SelectValue>
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            {options.map((org) => (
              <SelectItem key={org.organization_id} value={org.organization_id}>
                {org.name || org.organization_id}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      )}
    </section>
  )
}
