import { CircleAlertIcon, Loader2, PlusIcon } from "lucide-react"

import { ProponentCard } from "@/components/submission/proponent-card"
import {
  getDepartmentItem,
  MAX_PROPONENTS,
} from "@/components/submission/constants"
import type { Proponent } from "@/components/submission/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"
import { layout } from "@/config"

export function ProponentsSection({
  proponents,
  onUpdate,
  onRemove,
  onAdd,
}: {
  proponents: Proponent[]
  onUpdate: (id: string, field: keyof Proponent, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const canRemove = proponents.length > 1
  const atMax = proponents.length >= MAX_PROPONENTS
  // Every proponent belongs to the applying organization, so its name is
  // auto-filled rather than typed.
  const currentOrgQuery = useCurrentOrganizationQuery()
  const organizationName = currentOrgQuery.data?.name || ""
  const configuredDepartment = currentOrgQuery.data?.department?.trim() || ""
  const organizationDepartment =
    getDepartmentItem(configuredDepartment)?.code || ""
  const departmentIsMissing =
    !currentOrgQuery.isPending && organizationDepartment === ""

  return (
    <div className={layout.stack}>
      {currentOrgQuery.isPending ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertTitle>Resolving organization department</AlertTitle>
          <AlertDescription>
            Loading the department assigned to your organization&apos;s dean.
          </AlertDescription>
        </Alert>
      ) : null}

      {departmentIsMissing ? (
        <Alert variant="error">
          <CircleAlertIcon />
          <AlertTitle>Organization department cannot be resolved</AlertTitle>
          <AlertDescription>
            {configuredDepartment
              ? `The assigned dean's department (“${configuredDepartment}”) does not match a supported department.`
              : "A dean with a department must be assigned to your organization."}{" "}
            Please contact an administrator before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      {proponents.map((proponent, index) => (
        <ProponentCard
          key={proponent.id}
          proponent={proponent}
          index={index}
          canRemove={canRemove}
          departmentValue={organizationDepartment}
          organizationName={organizationName}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      {atMax ? (
        <p className="text-center text-xs text-neutral-500" role="note">
          Maximum of {MAX_PROPONENTS} proponents reached.
        </p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3.5 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-red-600 hover:bg-red-50/30 hover:text-red-700"
        >
          <PlusIcon className="h-4 w-4 text-neutral-600" />
          <span>Add Proponent</span>
        </button>
      )}
    </div>
  )
}
