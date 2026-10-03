import { memo } from "react"
import { BuildingIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { useDropdownFilter } from "@/hooks/use-dropdown-filter"

export interface DepartmentFilterProps {
  departments: string[]
  selected: string | null
  onSelect: (dept: string | null) => void
}

const DepartmentFilter = memo(function DepartmentFilter({
  departments,
  selected,
  onSelect,
}: DepartmentFilterProps) {
  const { open, toggle, close, clear, select } = useDropdownFilter(onSelect)

  return (
    <div className="relative">
      <button
        type="button"
        id="dept-filter-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs transition-all hover:border-neutral-300 hover:bg-neutral-50"
      >
        <BuildingIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="max-w-36 truncate">{selected ?? "Department"}</span>
        {selected ? (
          <XIcon
            className="w-3 h-3 text-neutral-400 hover:text-neutral-700 shrink-0"
            onClick={clear}
          />
        ) : (
          <ChevronDownIcon
            className={`w-3 h-3 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <ul
            role="listbox"
            aria-label="Select department"
            className="absolute left-0 top-full z-20 mt-1.5 max-h-64 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {departments.map((dept) => (
              <li
                key={dept}
                role="option"
                aria-selected={selected === dept}
                onClick={() => select(dept)}
                className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                  selected === dept
                    ? "bg-[#800000]/8 text-[#800000] font-semibold"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {dept}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
})

export { DepartmentFilter }
