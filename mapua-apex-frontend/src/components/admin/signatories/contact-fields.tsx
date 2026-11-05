import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { SignatoryContactValues } from "@/components/admin/signatories/signatory-contact"

interface SignatoryContactFieldsProps {
  /** Field id prefix, so the add card and the edit dialog never collide. */
  idPrefix: string
  onChange: (field: keyof SignatoryContactValues, value: string) => void
  values: SignatoryContactValues
}

/**
 * Optional desk contact details. All three reach the proponent through the
 * proposal's Signatories tab, and a blank one is simply left out of that tab.
 */
export function SignatoryContactFields({
  idPrefix,
  onChange,
  values,
}: SignatoryContactFieldsProps) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-contact-email`}>
          Contact email
        </FieldLabel>
        <Input
          autoComplete="off"
          id={`${idPrefix}-contact-email`}
          maxLength={254}
          name="contact_email"
          onChange={(event) =>
            onChange("contactEmail", event.currentTarget.value)
          }
          placeholder="osaar@mapua.edu.ph"
          type="email"
          value={values.contactEmail}
        />
        <FieldDescription>
          Where a proponent may write about a pending proposal. May differ from
          the login email.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-office`}>Office</FieldLabel>
        <Input
          autoComplete="off"
          id={`${idPrefix}-office`}
          maxLength={120}
          name="office"
          onChange={(event) => onChange("office", event.currentTarget.value)}
          placeholder="Room 204, YC Building"
          type="text"
          value={values.office}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-contact-number`}>
          Contact number
        </FieldLabel>
        <Input
          autoComplete="off"
          id={`${idPrefix}-contact-number`}
          maxLength={40}
          name="contact_number"
          onChange={(event) =>
            onChange("contactNumber", event.currentTarget.value)
          }
          placeholder="(02) 8888 0000"
          type="tel"
          value={values.contactNumber}
        />
      </Field>
    </>
  )
}
