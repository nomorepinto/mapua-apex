import { Mail, MapPin, Phone, Stamp } from "lucide-react"

import { signatoryChainLabel } from "@/lib/dynamodb-adapters"
import type { ApiApprovalChainContact } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

interface SubmissionSignatoriesTabProps {
  contacts: ApiApprovalChainContact[]
}

/**
 * The desks a proponent may still write to, in approval order.
 *
 * The backend already narrowed this to the current desk and the ones after it,
 * so the list reads as "who has my proposal, and who is next". Desks that
 * already signed off are deliberately absent — the Milestone tab covers those.
 */
export function SubmissionSignatoriesTab({
  contacts,
}: SubmissionSignatoriesTabProps) {
  const osaarCount = contacts.filter(
    (contact) => (contact.role ?? "").toLowerCase() === "osaar"
  ).length

  return (
    <div className="animate-in fade-in space-y-4 duration-200">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Stamp aria-hidden="true" className="size-4 text-[#8B0000]" />
          <h3 className="text-base font-bold text-neutral-900">
            Signatory Contacts
          </h3>
        </div>
        <p className="mb-4 text-xs font-semibold text-neutral-500">
          Reach out to the desk holding your proposal, or to the ones it still
          has to pass through.
        </p>

        {contacts.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            No signatory desks are recorded for this proposal yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {contacts.map((contact, index) => (
              <li
                className={cn(
                  "rounded-xl border p-4 shadow-2xs transition-colors",
                  contact.is_current
                    ? "border-amber-400/70 bg-gradient-to-b from-amber-50 to-amber-50/50"
                    : "border-neutral-200 bg-white"
                )}
                key={contact.signatory_id}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      contact.is_current
                        ? "bg-amber-500 text-white"
                        : "bg-neutral-200 text-neutral-600"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-neutral-900">
                    {contact.name.trim() === "" ? "Unnamed desk" : contact.name}
                  </span>
                  <span className="text-xs font-semibold text-neutral-500">
                    {signatoryChainLabel(contact, true, osaarCount)}
                  </span>
                  {contact.is_current ? (
                    <span className="rounded-sm bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-900 uppercase">
                      Awaiting this desk
                    </span>
                  ) : null}
                </div>

                <ContactLinks contact={contact} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ContactLinks({ contact }: { contact: ApiApprovalChainContact }) {
  const email = contact.contact_email?.trim() ?? ""
  const office = contact.office?.trim() ?? ""
  const number = contact.contact_number?.trim() ?? ""

  if (!email && !office && !number) {
    return (
      <p className="mt-2 pl-[34px] text-xs text-neutral-500">
        No contact details are on file for this desk.
      </p>
    )
  }

  return (
    <ul className="mt-2 flex flex-col gap-1.5 pl-[34px]">
      {email ? (
        <li className="flex items-center gap-2 text-xs sm:text-sm">
          <Mail
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
          <a
            className="font-medium text-[#8B0000] underline-offset-2 hover:underline"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </li>
      ) : null}
      {number ? (
        <li className="flex items-center gap-2 text-xs sm:text-sm">
          <Phone
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
          <a
            className="font-medium text-neutral-800 underline-offset-2 hover:underline"
            href={`tel:${number.replace(/[^+\d]/g, "")}`}
          >
            {number}
          </a>
        </li>
      ) : null}
      {office ? (
        <li className="flex items-center gap-2 text-xs text-neutral-600 sm:text-sm">
          <MapPin
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
          <span className="font-medium">{office}</span>
        </li>
      ) : null}
    </ul>
  )
}
