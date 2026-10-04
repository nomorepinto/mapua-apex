import { useMemo } from "react"

import { layout } from "@/config"
import {
  useAvailableOrganizationsQuery,
  useCurrentOrganizationQuery,
} from "@/hooks/use-submissions"

/**
 * Multi-select of dependent organizations for a collaborative submission.
 * The proponent (current) organization is excluded; selection is optional —
 * an empty selection means the submission has no collaborators.
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

  const toggle = (organizationId: string, checked: boolean) => {
    if (checked) {
      if (value.includes(organizationId)) return
      onChange([...value, organizationId])
      return
    }
    onChange(value.filter((id) => id !== organizationId))
  }

  return (
    <section className={layout.section}>
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
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {options.map((org) => {
            const checked = value.includes(org.organization_id)
            return (
              <label
                key={org.organization_id}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-700 select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    toggle(org.organization_id, event.target.checked)
                  }
                  className="h-4 w-4 cursor-pointer accent-red-700 focus:ring-red-700"
                />
                <span>{org.name || org.organization_id}</span>
              </label>
            )
          })}
        </div>
      )}
    </section>
  )
}
