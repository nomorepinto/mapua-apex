import { memo } from "react"

import type { ActivityBudgetItem } from "@/components/ui/activity.types"
import { formatPeso } from "@/lib/numeric-input"
import { cn } from "@/lib/utils"

export interface ActivityBudgetTableProps {
  items?: ActivityBudgetItem[]
  grandTotal?: number
  className?: string
}

export const ActivityBudgetTable = memo(function ActivityBudgetTable({
  items,
  grandTotal,
  className,
}: ActivityBudgetTableProps) {
  if (!items || items.length === 0) return null

  // Ensure there is at least one non-empty item or positive total
  const hasContent = items.some(
    (b) =>
      (b.item && b.item.trim() !== "" && b.item !== "1") ||
      b.total > 0 ||
      b.pricePerUnit > 0
  )

  if (!hasContent && (!grandTotal || grandTotal === 0)) {
    return null
  }

  const computedGrandTotal =
    typeof grandTotal === "number" && grandTotal > 0
      ? grandTotal
      : items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)

  return (
    <>
      <hr className="border-neutral-200" />

      <div className={cn("space-y-3 pt-2", className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-neutral-900">
            Budget Proposal
          </h4>
          {computedGrandTotal > 0 && (
            <span className="text-xs font-semibold text-neutral-500">
              Grand Total:{" "}
              <span className="font-bold text-neutral-900">
                ₱{formatPeso(computedGrandTotal)}
              </span>
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Item
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Unit
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Qty
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Price / Unit
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-neutral-50/60 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-neutral-900">
                    {item.item || <span className="text-neutral-400 italic">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-neutral-600">
                    {item.unit || "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-neutral-600">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-700">
                    ₱{formatPeso(item.pricePerUnit)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">
                    ₱{formatPeso(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            {computedGrandTotal > 0 && (
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50/80 font-semibold text-neutral-900">
                  <td
                    colSpan={4}
                    className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-neutral-600"
                  >
                    Grand Total
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-extrabold text-neutral-900">
                    ₱{formatPeso(computedGrandTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
})
