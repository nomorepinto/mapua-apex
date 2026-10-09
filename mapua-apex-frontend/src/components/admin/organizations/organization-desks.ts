import { toastManager } from "@/components/ui/toast"
import {
  findByRole,
  type SignatoryOption,
} from "@/components/admin-osa/signatory-roles"
import type {
  ApiOrganizationSignatory,
  ApiSignatory,
  OrganizationAssignableDeskRole,
} from "@/lib/dynamodb-adapters"

export type AssignableDesks = Record<
  OrganizationAssignableDeskRole,
  SignatoryOption | null
>

export function emptyDesks(): AssignableDesks {
  return { dean: null, adviser: null }
}

export const ORG_CSV_TEMPLATE =
  "name,dean,adviser,is_higher_council\nMapua Computing Society,Dr. Ana Reyes,Prof. Juan Dela Cruz,false\nIEEE Mapua,,Prof. Elena Tan,true\n"

export function toastBulkResult(created: number, failed: number, noun: string) {
  if (created > 0 && failed === 0) {
    toastManager.add({
      title: `${noun} added`,
      description: `Created ${created} ${noun.toLowerCase()}${created === 1 ? "" : "s"}.`,
      type: "success",
    })
    return
  }

  if (created > 0) {
    toastManager.add({
      title: `Partially added ${noun.toLowerCase()}s`,
      description: `Created ${created}. ${failed} failed.`,
      type: "warning",
    })
    return
  }

  toastManager.add({
    title: `Could not add ${noun.toLowerCase()}s`,
    description:
      failed > 0
        ? `${failed} row${failed === 1 ? "" : "s"} failed.`
        : "Nothing to import.",
    type: "error",
  })
}

export function withSharedDesks(
  dean: SignatoryOption | null,
  adviser: SignatoryOption,
  people: ApiSignatory[]
): ApiOrganizationSignatory[] | null {
  const admin = findByRole(people, "admin")
  const cdm = findByRole(people, "cdm")
  if (!admin || !cdm || !findByRole(people, "osaar")) {
    return null
  }

  return [
    // Higher-council organizations skip the dean desk, so the dean entry is
    // only attached when one was actually selected.
    ...(dean ? [{ role: "dean", signatory_id: dean.value } as const] : []),
    { role: "adviser", signatory_id: adviser.value },
    { role: "admin", signatory_id: admin.signatory_id },
    { role: "cdm", signatory_id: cdm.signatory_id },
  ]
}
