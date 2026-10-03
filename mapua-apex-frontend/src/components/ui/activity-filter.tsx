import { memo } from "react"
import { SlidersHorizontalIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { useActivityFilter } from "@/hooks/use-activity-filter"

export interface ActivityFilterProps {
  departments: string[]
  departmentOrgMap: Record<string, string[]>
  selectedDept: string | null
  selectedOrg: string | null
  onDeptSelect: (dept: string | null) => void
  onOrgSelect: (org: string | null) => void
}

const ActivityFilter = memo(function ActivityFilter({
  departments,
  departmentOrgMap,
  selectedDept,
  selectedOrg,
  onDeptSelect,
  onOrgSelect,
}: ActivityFilterProps) {
  const filter = useActivityFilter({
    selectedDept,
    selectedOrg,
    departmentOrgMap,
    onDeptSelect,
    onOrgSelect,
  })

  return (
    <div ref={filter.containerRef} className="relative">
      <button
        type="button"
        id="activity-filter-btn"
        aria-haspopup="dialog"
        aria-expanded={filter.open}
        onClick={filter.toggle}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-50"
      >
        <SlidersHorizontalIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="max-w-52 truncate text-neutral-700">{filter.label}</span>
        {filter.hasFilters ? (
          <XIcon
            className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-700 shrink-0 cursor-pointer"
            onClick={filter.handleClearAll}
          />
        ) : (
          <ChevronDownIcon
            className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${filter.open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {filter.open ? (
        <div
          role="dialog"
          aria-label="Filter by Department and Organization"
          className="absolute right-0 top-full z-30 mt-2 max-h-[min(24rem,70dvh)] w-[min(21.25rem,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden rounded-2xl border border-neutral-200 bg-white py-2 shadow-xl"
        >
          <div className="px-3 pt-1 pb-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1 mb-1">
              Department
            </p>
            <ul role="listbox" aria-label="Select department" className="space-y-0.5">
              {departments.length === 0 ? (
                <li className="px-3 py-2 text-xs text-neutral-400">
                  No departments available.
                </li>
              ) : (
                departments.map((dept) => {
                  const isSelected = selectedDept === dept
                  return (
                    <li
                      key={dept}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => filter.handleDeptClick(dept)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#800000]/8 text-[#800000] font-semibold"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <span>{dept}</span>
                      {isSelected ? <ChevronRightIcon className="w-3 h-3 text-[#800000]" /> : null}
                    </li>
                  )
                })
              )}
            </ul>
          </div>

          {selectedDept && filter.availableOrgs.length > 0 ? (
            <>
              <div className="my-2 border-t border-neutral-100" />
              <div className="px-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1 mb-1">
                  Organization
                </p>
                <ul role="listbox" aria-label="Select organization" className="space-y-0.5">
                  {filter.availableOrgs.map((org) => {
                    const isSelected = selectedOrg === org
                    return (
                      <li
                        key={org}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => filter.handleOrgClick(org)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#800000]/8 text-[#800000] font-semibold"
                            : "text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        <span>{org}</span>
                        {isSelected ? <XIcon className="w-3 h-3 text-[#800000]" /> : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          ) : null}

          {filter.hasFilters ? (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <div className="px-4 py-2">
                <button
                  type="button"
                  onClick={filter.handleClearAll}
                  className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

export { ActivityFilter }
