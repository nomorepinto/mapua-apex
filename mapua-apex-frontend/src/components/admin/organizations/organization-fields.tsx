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

function OrganizationFlagField({
  checked,
  description,
  id,
  label,
  name,
  onCheckedChange,
}: {
  checked: boolean
  description: string
  id: string
  label: string
  name: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field>
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          id={id}
          name={name}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <FieldDescription>{description}</FieldDescription>
        </div>
      </div>
    </Field>
  )
}

export function SkipDeanField({
  checked,
  id,
  onCheckedChange,
}: {
  checked: boolean
  id: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <OrganizationFlagField
      checked={checked}
      description="Skips the dean desk. Adviser still reviews first."
      id={id}
      label="Skip dean"
      name="skip_dean"
      onCheckedChange={onCheckedChange}
    />
  )
}

export function SkipPostEvalField({
  checked,
  id,
  onCheckedChange,
}: {
  checked: boolean
  id: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <OrganizationFlagField
      checked={checked}
      description="This organization does not file a post-evaluation."
      id={id}
      label="Skip post-eval"
      name="skip_post_eval"
      onCheckedChange={onCheckedChange}
    />
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
  disabled = false,
  emptyLabel,
  items,
  label,
  onValueChange,
  optionalLabel,
  placeholder,
  value,
}: {
  disabled?: boolean
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
        disabled={disabled || items.length === 0}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        items={items}
        onValueChange={onValueChange}
        value={value}
      >
        <ComboboxInput
          aria-label={label}
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
