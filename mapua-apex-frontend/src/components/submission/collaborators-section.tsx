import { useMemo } from "react"

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectSeparator,
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
 * Sentinel row standing for "no collaborating organizations". It is never part
 * of the draft: choosing it clears `dependentOrgs`, and an empty selection is
 * rendered back as this row so the default is explicit instead of looking like
 * an unanswered question.
 */
const NO_COLLABORATION = "__no_collaboration__"

/**
 * Multi-select dropdown of dependent organizations for a collaborative
 * submission. The proponent (current) organization is excluded; the default is
 * no collaboration.
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

  // An empty selection is shown as the explicit "No collaboration" row.
  const selected = value.length === 0 ? [NO_COLLABORATION] : value

  // Compact trigger summary for the coss multi-select render function.
  const renderValue = (items: string[]) => {
    const first = items[0] ?? ""
    if (items.length === 0 || first === NO_COLLABORATION) {
      return "No collaboration"
    }
    const label = nameById.get(first) ?? first
    return items.length > 1 ? `${label} (+${items.length - 1} more)` : label
  }

  const handleValueChange = (next: string[]) => {
    // Picking "No collaboration" drops every dependent organization; picking an
    // organization drops the sentinel.
    if (next.includes(NO_COLLABORATION) && value.length > 0) {
      onChange([])
      return
    }
    onChange(next.filter((id) => id !== NO_COLLABORATION))
  }

  return (
    <section className={cn(layout.section, "mt-4")}>
      <div className="mb-3 space-y-1">
        <h3 className="text-base font-bold text-neutral-900">
          Collaborating Organizations
        </h3>
        <p className="text-sm text-neutral-500">
          Optional — the default is no collaboration. Dependent organizations
          receive a read-only copy of this application and its notifications.
          Only your organization can edit or resubmit.
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
          value={selected}
          onValueChange={(next) => handleValueChange(next as string[])}
        >
          <SelectTrigger>
            <SelectValue>{renderValue}</SelectValue>
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            <SelectItem value={NO_COLLABORATION}>No collaboration</SelectItem>
            <SelectSeparator />
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
