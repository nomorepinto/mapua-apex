import { CampusSelect } from "@/components/admin/reservables/reservables-fields"
import { RequestDetail } from "@/components/cdm/reservations/request-detail"
import { RequestList } from "@/components/cdm/reservations/request-list"
import {
  ReservationsProvider,
  useReservationsPage,
} from "@/components/cdm/reservations/reservations-context"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { Card, CardPanel } from "@/components/ui/card"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function CdmReservationsPage() {
  return (
    <ReservationsProvider>
      <ReservationsBody />
    </ReservationsProvider>
  )
}

function ReservationsBody() {
  const { state, actions } = useReservationsPage()

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          subtitle="Resolve student requests to cancel or reschedule the holds on an approved paper. Each request lists the exact bookings it targets; resolving edits those bookings and the paper in lockstep and notifies the student."
          title="Reservations"
        />

        <Card className={cn(layout.card, "min-w-0")}>
          <CardPanel className="sm:max-w-sm">
            <CampusSelect
              campuses={state.campuses}
              disabled={state.campusesLoading}
              id="reservations-campus"
              onChange={actions.setCampusId}
              value={state.campusId}
            />
          </CardPanel>
        </Card>

        <div
          className={cn(
            "grid min-w-0 grid-cols-1 items-start lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
            layout.gap
          )}
        >
          <RequestList />
          <RequestDetail />
        </div>
      </div>
    </div>
  )
}
