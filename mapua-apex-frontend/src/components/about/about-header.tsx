import { MissingAccountLinkBadge } from "@/components/auth/missing-account-link-badge"
import { layout } from "@/config"

export function AboutHeader() {
  return (
    <div>
      <h1 className={layout.pageTitle}>
        About APEX
        <MissingAccountLinkBadge />
      </h1>
      <p className={layout.pageSubtitle}>
        Administrative Portal For Events Exchange — Mapúa University
      </p>
    </div>
  )
}
