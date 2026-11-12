import { ScrollArea } from "@/components/ui/scroll-area"
import { usePrivacyNoticeQuery, type ApiPrivacyNotice } from "@/hooks/use-privacy-notice"

/**
 * Read-only RA 10173 disclosure panel. The text and version come from the
 * backend notice (the authority the proponent consents against), so nothing
 * here duplicates the wording.
 */
export function PrivacyConsentNotice({ notice }: { notice: ApiPrivacyNotice }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50">
      <ScrollArea className="max-h-56 px-4 py-3" scrollbarGutter>
        <div className="space-y-3 text-left">
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              {notice.title}{" "}
              <span className="font-normal text-neutral-500">(v{notice.version})</span>
            </h4>
            <p className="text-xs text-neutral-500">Effective {notice.effective_date}</p>
          </div>
          <p className="text-xs leading-relaxed text-neutral-700">{notice.intro}</p>
          <NoticeSection title="What we collect" items={notice.collection} />
          <NoticeSection title="Why we process it" items={notice.purposes} />
          <NoticeSection title="Who we share it with" items={notice.sharing} />
          <NoticeSection title="Your rights" items={notice.rights} />
          <p className="text-xs leading-relaxed text-neutral-700">{notice.contact}</p>
        </div>
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
 * Consent-gate helper for the pre-submit dialog. `ready` is true only once the
 * current notice has loaded, so loading/error states keep the confirmation
 * disabled instead of silently passing. `version` is the notice version to
 * record against the submission.
 */
export function usePrivacyConsent() {
  const { data, isLoading, isError } = usePrivacyNoticeQuery()
  const notice = data ?? null
  const ready = notice !== null

  const content = isLoading ? (
    <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      Loading the Data Privacy Act notice…
    </p>
  ) : isError || !notice ? (
    <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
      The Data Privacy Act notice could not be loaded. Please try again before
      submitting.
    </p>
  ) : (
    <PrivacyConsentNotice notice={notice} />
  )

  const label = `I have read and agree to the Data Privacy Act of 2012 (RA 10173) notice${
    notice ? ` (v${notice.version})` : ""
  }.`

  return { content, label, ready, disabled: !ready, version: notice?.version ?? null }
}
