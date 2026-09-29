import {
  NO_DEPARTMENT,
  type DepartmentOption,
} from "@/components/admin/signatories/signatory-options"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DepartmentSelect({
  items,
  onValueChange,
  value,
}: {
  items: DepartmentOption[]
  onValueChange: (value: DepartmentOption | null) => void
  value: DepartmentOption | null
}) {
  const selectItems = [NO_DEPARTMENT, ...items]
  const selected = value && value.value ? value : NO_DEPARTMENT

  return (
    <Field>
      <FieldLabel>Department</FieldLabel>
      <Select
        itemToStringValue={(item) => item.value}
        items={selectItems}
        name="department"
        onValueChange={(item) => onValueChange(item && item.value ? item : null)}
        value={selected}
      >
        <SelectTrigger>
          <SelectValue placeholder="Optional" />
        </SelectTrigger>
        <SelectPopup>
          {selectItems.map((item) => (
            <SelectItem key={item.value || "none"} value={item}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <FieldDescription>
        Optional. Stored uppercase and used only for deans (
        <code>ROLE#DEAN#SOIT</code>).
      </FieldDescription>
    </Field>
  )
}
