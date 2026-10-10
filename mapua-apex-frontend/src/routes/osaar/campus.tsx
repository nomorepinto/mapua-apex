import { AddCampusCard } from "@/components/admin/campuses/add-campus-card"
import { CampusesLoadAlert } from "@/components/admin/campuses/campuses-load-alert"
import { CampusesProvider } from "@/components/admin/campuses/campuses-context"
import { CampusesTableCard } from "@/components/admin/campuses/campuses-table"
import { DeleteCampusDialog } from "@/components/admin/campuses/delete-campus-dialog"
import { EditCampusDialog } from "@/components/admin/campuses/edit-campus-dialog"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminCampusPage() {
  return (
    <CampusesProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <FormPageHeader
            subtitle="Register each campus so CDM can attach reservable rooms and equipment to it. Campuses replace the hardcoded venue list in the submission form."
            title="Campuses"
          />
          <CampusesLoadAlert />
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
              layout.gap
            )}
          >
            <AddCampusCard />
            <CampusesTableCard />
          </div>
        </div>
        <EditCampusDialog />
        <DeleteCampusDialog />
      </div>
    </CampusesProvider>
  )
}
