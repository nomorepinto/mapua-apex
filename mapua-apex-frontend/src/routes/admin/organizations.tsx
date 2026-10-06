import { AddOrganizationCard } from "@/components/admin/organizations/add-organization-card"
import { DeleteOrganizationDialog } from "@/components/admin/organizations/delete-organization-dialog"
import { EditOrganizationDialog } from "@/components/admin/organizations/edit-organization-dialog"
import { OrganizationsLoadAlert } from "@/components/admin/organizations/organizations-load-alert"
import { OrganizationsProvider } from "@/components/admin/organizations/organizations-context"
import { OrganizationsTableCard } from "@/components/admin/organizations/organizations-table"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminOrganizationsPage() {
  return (
    <OrganizationsProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <FormPageHeader
            subtitle="Assign a dean and adviser to each organization. Higher councils skip the dean — an adviser is enough. Admin, CDM, and OSAAR are shared accounts used by every organization."
            title="Organizations"
          />
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
        </div>
        <EditOrganizationDialog />
        <DeleteOrganizationDialog />
      </div>
    </OrganizationsProvider>
  )
}
