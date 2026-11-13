import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

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
import { PrivacyNoticeBody } from "@/components/submission/privacy-consent"
import { TermsNoticeBody } from "@/components/submission/terms-consent"
import { usePrivacyNoticeQuery } from "@/hooks/use-privacy-notice"
import { useTermsNoticeQuery } from "@/hooks/use-terms-notice"
import { modal } from "@/config"

/**
 * Account-creation consent gate. The full versioned notices (Terms &
 * Conditions plus the RA 10173 privacy notice) stay the backend's authority —
 * nothing here duplicates the wording. The gate is a compact "Terms and
 * conditions" button that opens the complete text in a scrollable dialog;
 * the single agreement checkbox sits at the very BOTTOM of that text, so the
 * user must scroll through the notices to reach it before they can accept.
 *
 * `onAcceptedChange` reports whether BOTH notices have loaded and the checkbox
 * is ticked. The parent keeps "Create account" disabled until then and
 * re-checks in its submit handler as defense-in-depth (implicit Enter
 * submission can still fire onSubmit while the button is disabled). It mounts
 * only while the sign-up modal is open, so the public notice reads fire on
 * demand, and unmounts on close/timeout to clear the tick.
 */
export function SignupConsentGate({
  disabled = false,
  onAcceptedChange,
}: {
  disabled?: boolean
  onAcceptedChange: (accepted: boolean) => void
}) {
  const termsQuery = useTermsNoticeQuery()
  const privacyQuery = usePrivacyNoticeQuery()
  const termsNotice = termsQuery.data ?? null
  const privacyNotice = privacyQuery.data ?? null

  // `ready` is true only once BOTH current notices have loaded, so loading/
  // error states keep the gate closed instead of silently passing.
  const ready = termsNotice !== null && privacyNotice !== null
  const loadFailed = termsQuery.isError || privacyQuery.isError

  const [dialogOpen, setDialogOpen] = useState(false)
  const [checked, setChecked] = useState(false)

  // A notice version bump clears the prior tick so acceptance always matches
  // the text currently on screen. Adjusted during render (the SignInModal
  // trackedOpen pattern) rather than in an effect to avoid cascading renders.
  const noticeVersions = `${privacyNotice?.version ?? ""}|${termsNotice?.version ?? ""}`
  const [prevVersions, setPrevVersions] = useState(noticeVersions)
  if (prevVersions !== noticeVersions) {
    setPrevVersions(noticeVersions)
    setChecked(false)
  }

  const accepted = ready && checked

  useEffect(() => {
    onAcceptedChange(accepted)
  }, [accepted, onAcceptedChange])

  const consentLabel = `I have read and agree to the Terms & Conditions${
    termsNotice ? ` (v${termsNotice.version})` : ""
  } and the Data Privacy Act of 2012 (RA 10173) notice${
    privacyNotice ? ` (v${privacyNotice.version})` : ""
  }.`

  return (
    <div className="space-y-2.5 border-t border-neutral-100 pt-4 text-left">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#b91c1c]" aria-hidden="true" />
        <p className="text-[11px] font-semibold text-neutral-700">
          Review and accept to create your account
        </p>
      </div>

      {/* Opens the full Terms & Conditions + privacy notice text in a dialog;
          the agreement checkbox lives at the bottom of that text */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setDialogOpen(true)}
      >
        Terms and conditions
      </Button>

      <p
        className={
          accepted
            ? "text-xs font-medium text-emerald-700"
            : loadFailed
              ? "text-xs text-destructive"
              : "text-xs text-neutral-500"
        }
      >
        {accepted
          ? "You have agreed to the Terms & Conditions."
          : loadFailed
            ? "The Terms & Conditions could not be loaded. Please close and reopen this dialog to try again."
            : !ready
              ? "Loading the Terms & Conditions…"
              : "Open the Terms and conditions and tick the agreement at the end of the text to enable account creation."}
      </p>

      {/* Scrollable dialog with the complete notice text, layered above the
          hand-rolled sign-up modal (z-50) via the nested z-[70] stack */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className={modal.dialogLg} nested showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Terms &amp; Conditions</DialogTitle>
            <DialogDescription>
              The Terms &amp; Conditions and the Data Privacy Act notice below
              govern your account. Please read them before accepting.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {ready ? (
              <div className="space-y-6">
                <TermsNoticeBody notice={termsNotice} showAcknowledgements />
                <hr className="border-neutral-200" />
                <PrivacyNoticeBody notice={privacyNotice} />
                {/* Agreement sits at the very bottom of the full text, so the
                    notices must be scrolled through before it can be ticked */}
                <hr className="border-neutral-200" />
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-neutral-700">
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => setChecked(Boolean(value))}
                  />
                  <span>{consentLabel}</span>
                </label>
              </div>
            ) : loadFailed ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                The Terms &amp; Conditions could not be loaded. Please try
                again before creating your account.
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
