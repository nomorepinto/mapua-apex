import { AddCampusCard } from "@/components/admin/campuses/add-campus-card"
import { CampusesLoadAlert } from "@/components/admin/campuses/campuses-load-alert"
import { CampusesProvider } from "@/components/admin/campuses/campuses-context"
import { CampusesTableCard } from "@/components/admin/campuses/campuses-table"
import { DeleteCampusDialog } from "@/components/admin/campuses/delete-campus-dialog"
import { EditCampusDialog } from "@/components/admin/campuses/edit-campus-dialog"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminCampusPage() {
  return (
    <CampusesProvider>
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
      <EditCampusDialog />
      <DeleteCampusDialog />
    </CampusesProvider>
  )
}
