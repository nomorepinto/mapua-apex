import { useCallback, useRef, type MouseEvent } from "react"

import { useClickOutside } from "@/hooks/use-click-outside"
import { useDisclosure } from "@/hooks/use-disclosure"

export function useActivityFilter({
  selectedDept,
  selectedOrg,
  departmentOrgMap,
  onDeptSelect,
  onOrgSelect,
}: {
  selectedDept: string | null
  selectedOrg: string | null
  departmentOrgMap: Record<string, string[]>
  onDeptSelect: (dept: string | null) => void
  onOrgSelect: (org: string | null) => void
}) {
  const { isOpen, toggle, close } = useDisclosure()
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, isOpen, close)

  const handleDeptClick = useCallback(
    (dept: string) => {
      if (selectedDept === dept) {
        onDeptSelect(null)
        onOrgSelect(null)
        return
      }
      onDeptSelect(dept)
      onOrgSelect(null)
    },
    [onDeptSelect, onOrgSelect, selectedDept]
  )

  const handleOrgClick = useCallback(
    (org: string) => {
      onOrgSelect(selectedOrg === org ? null : org)
    },
    [onOrgSelect, selectedOrg]
  )

  const handleClearAll = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onDeptSelect(null)
      onOrgSelect(null)
    },
    [onDeptSelect, onOrgSelect]
  )

  const hasFilters = selectedDept !== null || selectedOrg !== null
  const availableOrgs = selectedDept ? (departmentOrgMap[selectedDept] ?? []) : []

  let label = "Department & Organization"
  if (selectedDept && selectedOrg) label = `${selectedDept} / ${selectedOrg}`
  else if (selectedDept) label = selectedDept
  else if (selectedOrg) label = selectedOrg

  return {
    open: isOpen,
    toggle,
    close,
    containerRef,
    handleDeptClick,
    handleOrgClick,
    handleClearAll,
    hasFilters,
    availableOrgs,
    label,
  }
}
