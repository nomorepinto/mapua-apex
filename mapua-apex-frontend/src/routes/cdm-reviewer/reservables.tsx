import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  PlusIcon,
} from "lucide-react"

import { AddReservableSection } from "@/components/admin/reservables/add-reservable-section"
import { ReserveSection } from "@/components/admin/reservables/reserve-section"
import {
  ReservablesProvider,
  useReservablesPage,
  type ReservableSection,
} from "@/components/admin/reservables/reservables-context"
import { ReservablesLoadAlert } from "@/components/admin/reservables/reservables-load-alert"
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { ViewReservableSection } from "@/components/admin/reservables/view-reservable-section"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const SECTION_ITEMS: SegmentedItem<ReservableSection>[] = [
  { value: "add", label: "Add", icon: PlusIcon },
  { value: "view", label: "View", icon: CalendarDaysIcon },
  { value: "reserve", label: "Reserve", icon: CalendarCheckIcon },
]

export function AdminReservablesPage() {
  return (
    <ReservablesProvider>
      <ReservablesBody />
    </ReservablesProvider>
  )
}

function ReservablesBody() {
  const { state, actions } = useReservablesPage()

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          subtitle="Define the rooms and equipment orgs can reserve, inspect live availability, and hold slots for campus use. Reservables replace the hardcoded venue and equipment catalogs in the submission form."
          title="Reservables"
        />
        <ReservablesLoadAlert />
        <SegmentedControl
          ariaLabel="Reservables section"
          items={SECTION_ITEMS}
          mode="tablist"
          onChange={actions.setSection}
          value={state.section}
        />
        {state.section === "add" ? <AddReservableSection /> : null}
        {state.section === "view" ? <ViewReservableSection /> : null}
        {state.section === "reserve" ? <ReserveSection /> : null}
      </div>
    </div>
  )
}
