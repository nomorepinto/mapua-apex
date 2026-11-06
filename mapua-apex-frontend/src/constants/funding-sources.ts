/**
 * Funding sources offered on the proposal setup step. The stored value is the
 * slug; the label is what reviewers and the wizard see. The order here is the
 * display order everywhere the field renders.
 */
export const FUNDING_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "sponsors", label: "Sponsors" },
  { value: "concessionaires", label: "Concessionaires" },
  { value: "department", label: "Department" },
  { value: "organization", label: "Organization" },
  { value: "member_contributions", label: "Member Contributions" },
  { value: "others", label: "Others" },
]

const LABEL_BY_VALUE = new Map(
  FUNDING_SOURCE_OPTIONS.map((option) => [option.value, option.label])
)

/**
 * Map stored funding-source slugs to their display labels in selection order,
 * dropping any value that is not a known source (e.g. a slug retired later).
 */
export function fundingSourceLabels(values: string[]): string[] {
  return values
    .map((value) => LABEL_BY_VALUE.get(value))
    .filter((label): label is string => Boolean(label))
}
