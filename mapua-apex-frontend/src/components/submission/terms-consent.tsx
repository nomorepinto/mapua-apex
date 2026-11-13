import { ScrollArea } from "@/components/ui/scroll-area"
import { useTermsNoticeQuery, type ApiTermsNotice } from "@/hooks/use-terms-notice"

/**
 * Full T&C notice text, version-free layout (no border or height cap) so
 * surfaces like the sign-up modal can render the complete notice inside their
 * own scroll container. The wording always comes from the backend notice.
 * `showAcknowledgements` folds the acknowledgement items into the text for
 * surfaces without per-item checkboxes; the SAAF panel keeps them on the
 * ticks instead.
 */
export function TermsNoticeBody({
  notice,
  showAcknowledgements = false,
}: {
  notice: ApiTermsNotice
  showAcknowledgements?: boolean
}) {
  return (
    <div className="space-y-3 text-left">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">
          {notice.title}{" "}
          <span className="font-normal text-neutral-500">(v{notice.version})</span>
        </h4>
        <p className="text-xs text-neutral-500">Effective {notice.effective_date}</p>
      </div>
      <p className="text-xs leading-relaxed text-neutral-700">{notice.intro}</p>
      <div>
        <h5 className="text-xs font-semibold text-neutral-900">Turnaround time</h5>
        <p className="mt-1 text-xs leading-relaxed text-neutral-700">
          {notice.turnaround_time}
        </p>
      </div>
      <div>
        <h5 className="text-xs font-semibold text-neutral-900">Filing window</h5>
        <p className="mt-1 text-xs leading-relaxed text-neutral-700">
          {notice.filing_window}
        </p>
      </div>
      <NoticeSection title="Major event criteria" items={notice.major_event_criteria} />
      <NoticeSection title="Minor event criteria" items={notice.minor_event_criteria} />
      {showAcknowledgements && (
        <NoticeSection title="Acknowledgements" items={notice.acknowledgements} />
      )}
    </div>
  )
}

/**
 * Read-only SAAF Terms & Conditions panel (S-1). The text and version come
 * from the backend notice (the authority the proponent consents against), so
 * nothing here duplicates the wording.
 */
export function TermsConsentNotice({ notice }: { notice: ApiTermsNotice }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50">
      <ScrollArea className="max-h-56 px-4 py-3" scrollbarGutter>
        <TermsNoticeBody notice={notice} />
      </ScrollArea>
    </div>
  )
}

function NoticeSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <h5 className="text-xs font-semibold text-neutral-900">{title}</h5>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item} className="text-xs leading-relaxed text-neutral-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * T&C consent-gate helper for the pre-submit dialog (S-1), mirroring
 * `usePrivacyConsent`. `ready` is true only once the current notice has
 * loaded, so loading/error states keep the confirmation disabled instead of
 * silently passing. `checkboxes` are the explicit acknowledgements the
 * proponent must ALL tick before Proceed; `version` is the notice version to
 * record against the submission.
 */
export function useTermsConsent() {
  const { data, isLoading, isError } = useTermsNoticeQuery()
  const notice = data ?? null
  const ready = notice !== null

  const content = isLoading ? (
    <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      Loading the Terms &amp; Conditions…
    </p>
  ) : isError || !notice ? (
    <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
      The Terms &amp; Conditions could not be loaded. Please try again before
      submitting.
    </p>
  ) : (
    <TermsConsentNotice notice={notice} />
  )

  const checkboxes = (notice?.acknowledgements ?? []).map((label) => ({ label }))

  return {
    content,
    checkboxes,
    ready,
    disabled: !ready,
    version: notice?.version ?? null,
  }
}