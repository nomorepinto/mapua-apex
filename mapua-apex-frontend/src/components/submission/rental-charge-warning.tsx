import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * S-3 trigger: a selling/fundraising nature of activity or concessionaire
 * funding signals booth/concessionaire rental. Text only — no charge, payee,
 * or amount is computed anywhere (pending Q-A).
 */
export function hasRentalSignal(
  activityNature: string[] | undefined,
  fundingSources: string[] | undefined
): boolean {
  const nature = activityNature ?? []
  return (
    nature.includes("Selling activity") ||
    nature.includes("Fundraising/charity") ||
    (fundingSources ?? []).includes("concessionaires")
  )
}

/**
 * Booth / concessionaire rental warning shown on the Activity and Budget steps
 * when the rental signal is present. The charges themselves are coordinated
 * separately; this alert never states a fee amount.
 */
export function RentalChargeWarning() {
  return (
    <Alert variant="warning">
      <CircleAlertIcon />
      <AlertTitle>Booth / concessionaire rental charges apply</AlertTitle>
      <AlertDescription>
        <p>
          Selling or fundraising activities and events funded by concessionaires
          are subject to booth and concessionaire rental charges. The applicable
          charges will be coordinated with your organization separately.
        </p>
      </AlertDescription>
    </Alert>
  )
}