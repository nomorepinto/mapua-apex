import { useEffect, useState } from "react"

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TermsNoticeBody } from "@/components/submission/terms-consent"
import { useTermsNoticeQuery } from "@/hooks/use-terms-notice"
import { modal } from "@/config"

/**
 * Compact Terms & Conditions consent gate: a small "Terms and conditions"
 * button that opens the full versioned backend notice (acknowledgements
 * folded into the text) in a scrollable dialog, with a single agreement
 * checkbox directly below the button. The tick only counts once the notice
 * has loaded, and a notice version bump clears it so acceptance always
 * matches the text on screen.
 *
 * `onAcceptedChange` reports whether the notice has loaded AND the checkbox
 * is ticked. Hosts keep their action button disabled until then and should
 * re-check in their submit handler as defense-in-depth (implicit Enter
 * submission can still fire onSubmit while the button is disabled).
 */
export function TermsConsentGate({
  disabled = false,
  onAcceptedChange,
}: {
  disabled?: boolean
  onAcceptedChange: (accepted: boolean) => void
}) {
  const termsQuery = useTermsNoticeQuery()
  const notice = termsQuery.data ?? null

  // `ready` is true only once the current notice has loaded, so loading/error
  // states keep the gate closed instead of silently passing.
  const ready = notice !== null

  const [dialogOpen, setDialogOpen] = useState(false)
  const [checked, setChecked] = useState(false)

  // A notice version bump clears the prior tick. Adjusted during render (the
  // SignInModal trackedOpen pattern) rather than in an effect to avoid
  // cascading renders.
  const [prevVersion, setPrevVersion] = useState(notice?.version ?? "")
  if (prevVersion !== (notice?.version ?? "")) {
    setPrevVersion(notice?.version ?? "")
    setChecked(false)
  }

  const accepted = ready && checked

  useEffect(() => {
    onAcceptedChange(accepted)
  }, [accepted, onAcceptedChange])

  const consentLabel = `I have read and agree to the Terms & Conditions${
    notice ? ` (v${notice.version})` : ""
  }.`

  return (
    <div className="space-y-2.5 text-left">
      {/* Opens the full Terms & Conditions text in a dialog */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setDialogOpen(true)}
      >
        Terms and conditions
      </Button>

      {/* Single agreement checkbox gating the host's action */}
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-neutral-700">
        <Checkbox
          className="mt-0.5"
          checked={checked}
          disabled={disabled || !ready}
          onCheckedChange={(value) => setChecked(Boolean(value))}
        />
        <span>{consentLabel}</span>
      </label>

      {!ready && (
        <p className={termsQuery.isError ? "text-xs text-destructive" : "text-xs text-neutral-500"}>
          {termsQuery.isError
            ? "The Terms & Conditions could not be loaded. Please try again before continuing."
            : "Loading the Terms & Conditions…"}
        </p>
      )}

      {/* Scrollable dialog with the complete notice text */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className={modal.dialogLg} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Terms &amp; Conditions</DialogTitle>
            <DialogDescription>
              The Terms &amp; Conditions below govern this activity
              application. Please read them before accepting.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {ready ? (
              <TermsNoticeBody notice={notice} showAcknowledgements />
            ) : termsQuery.isError ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                The Terms &amp; Conditions could not be loaded. Please try
                again before continuing.
              </p>
            ) : (
              <p className="px-4 py-3 text-xs text-neutral-500">
                Loading the Terms &amp; Conditions…
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="secondary" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
