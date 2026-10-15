import { AddMemberCard } from "@/components/students/members/add-member-card"
import { DeleteMemberDialog } from "@/components/students/members/delete-member-dialog"
import { EditMemberDialog } from "@/components/students/members/edit-member-dialog"
import { MembersLoadAlert } from "@/components/students/members/members-load-alert"
import { MembersProvider } from "@/components/students/members/members-context"
import { MembersTableCard } from "@/components/students/members/members-table"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function StudentMembersPage() {
  return (
    <MembersProvider>
      <div className={cn(layout.page, layout.stack)}>
        <div className={layout.container}>
          <MembersLoadAlert />
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
              layout.gap
            )}
          >
            <AddMemberCard />
            <MembersTableCard />
          </div>
          <EditMemberDialog />
          <DeleteMemberDialog />
        </div>
      </div>
    </MembersProvider>
  )
}
