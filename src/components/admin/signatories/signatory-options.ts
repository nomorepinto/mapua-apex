import { DEPARTMENT_ITEMS } from "@/lib/departments"
import {
  SIGNATORY_ROLE_ITEMS,
  type SignatoryRoleValue,
} from "@/components/admin-osa/signatory-roles"

export type RoleOption = { label: string; value: SignatoryRoleValue }
export type DepartmentOption = { label: string; value: string }

export const ROLE_ITEMS: RoleOption[] = SIGNATORY_ROLE_ITEMS.map((item) => ({
  label: item.label,
  value: item.value,
}))

export const DEPT_ITEMS = DEPARTMENT_ITEMS.map((item) => ({ ...item }))

export const NO_DEPARTMENT: DepartmentOption = {
  label: "No department",
  value: "",
}

export const SIGNATORY_CSV_TEMPLATE =
  "name,role,department\nProf. Juan Dela Cruz,adviser,\nDean Maria Santos,dean,SOIT\nMaria Santos,admin,\nEngr. Leo Cruz,cdm,\nAtty. Kim Ramos,osaar,\n"

export function departmentOption(code?: string | null): DepartmentOption | null {
  if (!code) {
    return null
  }
  const needle = code.trim().toUpperCase()
  return (
    DEPT_ITEMS.find((item) => item.value === needle) ?? {
      label: needle,
      value: needle,
    }
  )
}
