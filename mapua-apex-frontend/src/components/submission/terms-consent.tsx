import type { ApiTermsNotice } from "@/hooks/use-terms-notice"

/**
 * Full T&C notice text, version-free layout (no border or height cap) so
 * surfaces like the sign-up modal can render the complete notice inside their
 * own scroll container. The wording always comes from the backend notice.
 * `showAcknowledgements` folds the acknowledgement items into the text for
 * surfaces without per-item checkboxes.
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
