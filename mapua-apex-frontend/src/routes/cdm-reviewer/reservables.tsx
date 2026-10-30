import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  PlusIcon,
} from "lucide-react"
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router"

import { ReservablesProvider, type ReservableSection } from "@/components/admin/reservables/reservables-context"
import { ReservablesLoadAlert } from "@/components/admin/reservables/reservables-load-alert"
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const SECTION_ITEMS: SegmentedItem<ReservableSection>[] = [
  { value: "add", label: "Add", icon: PlusIcon },
  { value: "view", label: "View", icon: CalendarDaysIcon },
  { value: "reserve", label: "Reserve", icon: CalendarCheckIcon },
]

function resolveSection(pathname: string): ReservableSection {
  const segment = pathname.split("/").filter(Boolean).pop()
  return SECTION_ITEMS.some((item) => item.value === segment)
    ? (segment as ReservableSection)
    : "add"
}

export function ReservablesLayout() {
  return (
    <ReservablesProvider>
      <ReservablesFrame />
    </ReservablesProvider>
  )
}

function ReservablesFrame() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = resolveSection(location.pathname)

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
          onChange={(value) => navigate(`/cdm/reservables/${value}`)}
          value={section}
        />
        <Outlet />
      </div>
    </div>
  )
}

/** Sends `/cdm/reservables` and old `?section=` links to the matching child path. */
export function ReservablesIndexRedirect() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get("section")
  const target =
    section === "add" || section === "view" || section === "reserve"
      ? section
      : "add"

  return <Navigate to={`/cdm/reservables/${target}`} replace />
}
