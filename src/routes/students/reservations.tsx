import { ReservationDialogs } from "@/components/students/reservations/reservation-dialogs"
import { ReservationForm, ReservationIntro } from "@/components/students/reservations/reservation-form"
import { ReservationGate } from "@/components/students/reservations/reservation-gate"
import { ReservationProvider } from "@/components/students/reservations/reservation-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function Reservation() {
  return (
    <ReservationProvider>
      <ReservationGate>
        <div className={cn("relative", layout.page)}>
          <div className={cn(layout.container, layout.stack)}>
            <ReservationIntro />
            <ReservationForm />
          </div>
          <ReservationDialogs />
        </div>
      </ReservationGate>
    </ReservationProvider>
  )
}
