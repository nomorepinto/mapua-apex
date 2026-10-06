import type { SignatoryOption } from "@/components/admin-osa/signatory-roles"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import type { ApiSignatory } from "@/lib/dynamodb-adapters"

export function HigherCouncilField({
  checked,
  id,
  onCheckedChange,
}: {
  checked: boolean
  id: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field>
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          id={id}
          name="is_higher_council"
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={id}>Higher council</FieldLabel>
          <FieldDescription>
            Skips dean on the approval path. Adviser still reviews first.
          </FieldDescription>
        </div>
      </div>
    </Field>
  )
}

export function DeskName({
  signatoryId,
  person,
}: {
  signatoryId?: string
  person?: ApiSignatory
}) {
  if (person) {
    return <span className="whitespace-normal">{person.name}</span>
  }
  if (signatoryId) {
    return <span className="text-muted-foreground">Unassigned</span>
  }
  return <span className="text-muted-foreground">—</span>
}

export function SignatoryDeskCombobox({
  emptyLabel,
  items,
  label,
  onValueChange,
  optionalLabel,
  placeholder,
  value,
}: {
  emptyLabel: string
  items: SignatoryOption[]
  label: string
  onValueChange: (value: SignatoryOption | null) => void
  optionalLabel?: string
  placeholder: string
  value: SignatoryOption | null
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        disabled={items.length === 0}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        items={items}
        onValueChange={onValueChange}
        value={value}
      >
        <ComboboxInput
          placeholder={items.length === 0 ? emptyLabel : placeholder}
          showClear
        />
        <ComboboxPopup>
          <ComboboxEmpty>No matching {label.toLowerCase()}.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      {optionalLabel ? <FieldDescription>{optionalLabel}</FieldDescription> : null}
    </Field>
  )
}
