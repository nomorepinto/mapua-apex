import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { usePrivacyConsent } from "@/components/submission/privacy-consent"
import { useTermsConsent } from "@/components/submission/terms-consent"

/**
 * Account-creation consent gate. Mirrors the SAAF pre-submit gate (the RA 10173
 * privacy notice plus the versioned Terms & Conditions with tick-to-acknowledge
 * items) so the same backend notices stay the authority here too — nothing
 * duplicates the wording. It mounts only while the sign-up modal is open, so the
 * public notice reads fire on demand, and unmounts on close/timeout to clear
 * every tick.
 *
 * `onAcceptedChange` reports whether BOTH notices have loaded and EVERY box is
 * ticked. The parent keeps "Create account" disabled until then and re-checks in
 * its submit handler as defense-in-depth (implicit Enter submission can still
 * fire onSubmit while the button is disabled).
 */
export function SignupConsentGate({
  disabled = false,
  onAcceptedChange,
}: {
  disabled?: boolean
  onAcceptedChange: (accepted: boolean) => void
}) {
  const privacyConsent = usePrivacyConsent()
  const termsConsent = useTermsConsent()

  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [termsChecked, setTermsChecked] = useState<boolean[]>([])

  const termsCount = termsConsent.checkboxes.length

  // A notice version bump clears prior ticks so acceptance always matches the
  // text currently on screen. Adjusted during render (the SignInModal
  // trackedOpen pattern) rather than in an effect to avoid cascading renders.
  const noticeVersions = `${privacyConsent.version ?? ""}|${termsConsent.version ?? ""}`
  const [prevVersions, setPrevVersions] = useState(noticeVersions)
  if (prevVersions !== noticeVersions) {
    setPrevVersions(noticeVersions)
    setPrivacyChecked(false)
    setTermsChecked([])
  }

  const handleTermsChange = (index: number, checked: boolean) => {
    setTermsChecked((current) => {
      const next = [...current]
      while (next.length < termsCount) next.push(false)
      next[index] = checked
      return next
    })
  }

  const allTermsChecked =
    termsCount > 0 &&
    termsConsent.checkboxes.every((_, index) => termsChecked[index] === true)

  const accepted =
    privacyConsent.ready && termsConsent.ready && privacyChecked && allTermsChecked

  useEffect(() => {
    onAcceptedChange(accepted)
  }, [accepted, onAcceptedChange])

  return (
    <div className="space-y-3 border-t border-neutral-100 pt-4 text-left">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#b91c1c]" aria-hidden="true" />
        <p className="text-[11px] font-semibold text-neutral-700">
          Review and accept to create your account
        </p>
      </div>

      {/* Data Privacy Act notice + single consent checkbox */}
      <div className="space-y-2">
        {privacyConsent.content}
        <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-neutral-700">
          <Checkbox
            className="mt-0.5"
            checked={privacyChecked}
            disabled={disabled || privacyConsent.disabled}
            onCheckedChange={(checked) => setPrivacyChecked(Boolean(checked))}
          />
          <span>{privacyConsent.label}</span>
        </label>
      </div>

      {/* Terms & Conditions notice + one checkbox per acknowledgement */}
      <div className="space-y-2">
        {termsConsent.content}
        {termsConsent.checkboxes.map((item, index) => (
          <label
            key={index}
            className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-neutral-700"
          >
            <Checkbox
              className="mt-0.5"
              checked={termsChecked[index] === true}
              disabled={disabled || termsConsent.disabled}
              onCheckedChange={(checked) => handleTermsChange(index, Boolean(checked))}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}