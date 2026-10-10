import { AddSignatoryCard } from "@/components/admin/signatories/add-signatory-card"
import { DeleteSignatoryDialog } from "@/components/admin/signatories/delete-signatory-dialog"
import { EditSignatoryDialog } from "@/components/admin/signatories/edit-signatory-dialog"
import { SignatoriesLoadAlert } from "@/components/admin/signatories/signatories-load-alert"
import { SignatoriesProvider } from "@/components/admin/signatories/signatories-context"
import { SignatoriesTableCard } from "@/components/admin/signatories/signatories-table"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminSignatoriesPage() {
  return (
    <SignatoriesProvider>
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
      <EditSignatoryDialog />
      <DeleteSignatoryDialog />
    </SignatoriesProvider>
  )
}
