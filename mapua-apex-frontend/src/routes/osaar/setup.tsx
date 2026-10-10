import { Building2Icon, MapPinIcon, StampIcon } from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router"

import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

type SetupSection = "organizations" | "signatories" | "campuses"

const SECTION_ITEMS: SegmentedItem<SetupSection>[] = [
  { value: "organizations", label: "Organizations", icon: Building2Icon },
  { value: "signatories", label: "Signatories", icon: StampIcon },
  { value: "campuses", label: "Campuses", icon: MapPinIcon },
]

function resolveSection(pathname: string): SetupSection {
  const segment = pathname.split("/").filter(Boolean).pop()
  return SECTION_ITEMS.some((item) => item.value === segment)
    ? (segment as SetupSection)
    : "organizations"
}

export function OsaarSetupLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = resolveSection(location.pathname)

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          subtitle="Maintain the system's foundational records: student organizations and their desks, the signatories who approve proposals, and the campuses CDM attaches reservable rooms and equipment to."
          title="Setup"
        />
        <SegmentedControl
          ariaLabel="Setup section"
          items={SECTION_ITEMS}
          mode="tablist"
          onChange={(value) => navigate(`/osaar/setup/${value}`)}
          value={section}
        />
        <Outlet />
      </div>
    </div>
  )
}
