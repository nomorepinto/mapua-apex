import { AddSignatoryCard } from "@/components/admin/signatories/add-signatory-card"
import { EditSignatoryDialog } from "@/components/admin/signatories/edit-signatory-dialog"
import { SignatoriesLoadAlert } from "@/components/admin/signatories/signatories-load-alert"
import { SignatoriesProvider } from "@/components/admin/signatories/signatories-context"
import { SignatoriesTableCard } from "@/components/admin/signatories/signatories-table"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminSignatoriesPage() {
  return (
    <SignatoriesProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <FormPageHeader
            subtitle="Register deans, advisers, and the shared admin, CDM, and OSAAR accounts. Department applies only to deans."
            title="Signatories"
          />
          <SignatoriesLoadAlert />
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]",
              layout.gap
            )}
          >
            <AddSignatoryCard />
            <SignatoriesTableCard />
          </div>
        </div>
        <EditSignatoryDialog />
      </div>
    </SignatoriesProvider>
  )
}
