/**
 * Shared budget catalog constants.
 *
 * Extracted so the SAAF budget proposal section and the post-eval financial
 * report section reference one source of truth.
 */

export const BUDGET_OPTIONS = [
  "Certificate / Certificate Holder",
  "Printing Services",
  "Design Materials",
  "Food and Refreshments",
  "Honorarium",
  "Equipment Rental",
]

// Mapping of items to their fixed unit (auto-filled, read-only)
export const UNIT_MAP: Record<string, string> = {
  "Certificate / Certificate Holder": "pcs",
  "Printing Services": "page/pages",
  "Design Materials": "pcs",
  "Food and Refreshments": "pax",
  "Honorarium": "pax",
  "Equipment Rental": "day/days",
}

// Maximum number of digits allowed for quantity per item
export const QUANTITY_MAX_MAP: Record<string, number> = {
  "Certificate / Certificate Holder": 2,
  "Printing Services": 3,
  "Design Materials": 2,
  "Food and Refreshments": 3,
  "Honorarium": 1,
  "Equipment Rental": 1,
  Others: 3,
}
