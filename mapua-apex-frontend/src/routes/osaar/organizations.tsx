import { AddOrganizationCard } from "@/components/admin/organizations/add-organization-card"
import { DeleteOrganizationDialog } from "@/components/admin/organizations/delete-organization-dialog"
import { EditOrganizationDialog } from "@/components/admin/organizations/edit-organization-dialog"
import { OrganizationsLoadAlert } from "@/components/admin/organizations/organizations-load-alert"
import { OrganizationsProvider } from "@/components/admin/organizations/organizations-context"
import { OrganizationsTableCard } from "@/components/admin/organizations/organizations-table"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminOrganizationsPage() {
  return (
    <OrganizationsProvider>
      <OrganizationsLoadAlert />
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
          layout.gap
        )}
      >
        <AddOrganizationCard />
        <OrganizationsTableCard />
      </div>
      <EditOrganizationDialog />
      <DeleteOrganizationDialog />
    </OrganizationsProvider>
  )
}
