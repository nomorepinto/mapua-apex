/** Desk contact details as held by the add form and the edit dialog. */
export interface SignatoryContactValues {
  contactEmail: string
  office: string
  contactNumber: string
}

export const EMPTY_SIGNATORY_CONTACT: SignatoryContactValues = {
  contactEmail: "",
  office: "",
  contactNumber: "",
}

/** Contact details read off a stored signatory, blank where nothing is on file. */
export function signatoryContactOf(person: {
  contact_email?: string | null
  office?: string | null
  contact_number?: string | null
}): SignatoryContactValues {
  return {
    contactEmail: person.contact_email ?? "",
    office: person.office ?? "",
    contactNumber: person.contact_number ?? "",
  }
}
