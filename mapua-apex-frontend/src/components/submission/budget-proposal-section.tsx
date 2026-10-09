import { memo, useState } from "react"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import type { BudgetItem } from "@/components/submission/types"
import {
  blockNonDecimalKeys,
  blockNonIntegerKeys,
  calculateRowTotal,
  formatPeso,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const BUDGET_OPTIONS = [
  "Certificate / Certificate Holder",
  "Printing Services",
  "Design Materials",
  "Food and Refreshments",
  "Honorarium",
  "Equipment Rental",
]

// Mapping of items to their fixed unit (auto-filled, read-only)
const UNIT_MAP: Record<string, string> = {
  "Certificate / Certificate Holder": "pcs",
  "Printing Services": "page/pages",
  "Design Materials": "pcs",
  "Food and Refreshments": "pax",
  "Honorarium": "pax",
  "Equipment Rental": "day/days",
}

// Maximum number of digits allowed for quantity per item
const QUANTITY_MAX_MAP: Record<string, number> = {
  "Certificate / Certificate Holder": 2,
  "Printing Services": 3,
  "Design Materials": 2,
  "Food and Refreshments": 3,
  "Honorarium": 1,
  "Equipment Rental": 1,
  "Others": 3,
}

const BudgetRow = memo(function BudgetRow({
  item,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: {
  item: BudgetItem
  index: number
  canRemove: boolean
  onUpdate: (id: string, field: keyof BudgetItem, value: string) => void
  onRemove: (id: string) => void
}) {
  const rowTotal = calculateRowTotal(item.quantity, item.pricePerUnit)
  const [isCustomItem, setIsCustomItem] = useState(() => {
    return Boolean(item.item && !BUDGET_OPTIONS.includes(item.item) && item.item !== "Others")
  })

  const isOthersItem = item.item === "Others" || isCustomItem
  const maxQty = QUANTITY_MAX_MAP[item.item] || 3
  // Check if this item has a fixed unit
  const fixedUnit = !isOthersItem ? UNIT_MAP[item.item] : undefined

  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="border-r border-neutral-300 p-2 text-center">
        {isCustomItem ? (
          <div className="relative flex items-center">
            <input
              type="text"
              name={`budgetItem_${index}_name`}
              value={item.item}
              maxLength={25}
              placeholder="Enter custom item..."
              style={{ color: "#171717" }}
              onChange={(e) => onUpdate(item.id, "item", e.target.value)}
              className="w-full rounded border border-transparent bg-transparent pl-3 pr-8 py-1 text-center text-sm !text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setIsCustomItem(false)
                onUpdate(item.id, "item", "")
                onUpdate(item.id, "unit", "")
              }}
              className="absolute right-1 p-1 text-neutral-400 hover:text-neutral-600"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Select
            value={item.item || null}
            onValueChange={(val: string | null) => {
              if (val === "Others") {
                setIsCustomItem(true)
                onUpdate(item.id, "item", "")
                onUpdate(item.id, "unit", "")
                if (item.quantity.length > 3) {
                  onUpdate(item.id, "quantity", item.quantity.slice(0, 3))
                }
              } else {
                onUpdate(item.id, "item", val ?? "")
                // Auto-set the fixed unit for this item
                const unit = UNIT_MAP[val ?? ""]
                onUpdate(item.id, "unit", unit ?? "")
                // Reset quantity if it exceeds new max
                const newMax = QUANTITY_MAX_MAP[val ?? ""] || 3
                if (item.quantity.length > newMax) {
                  onUpdate(item.id, "quantity", item.quantity.slice(0, newMax))
                }
              }
            }}
          >
            <SelectTrigger className="w-full border-transparent bg-transparent shadow-none hover:bg-neutral-100 focus:bg-white focus:border-neutral-300 h-8">
              <SelectValue placeholder="Select item..." />
            </SelectTrigger>
            <SelectPopup>
              {BUDGET_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
              <SelectItem value="Others">Others</SelectItem>
            </SelectPopup>
          </Select>
        )}
      </td>
      <td className="border-r border-neutral-300 p-2 text-center">
        {isOthersItem ? (
          /* Others: free-text unit input, max 5 chars, no numbers */
          <input
            type="text"
            maxLength={5}
            name={`budgetItem_${index}_unit`}
            value={item.unit}
            placeholder="Unit"
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[0-9]/g, "").slice(0, 5)
              onUpdate(item.id, "unit", cleaned)
            }}
            style={{ color: "#171717" }}
            className="w-full rounded border border-transparent bg-transparent py-1 text-center text-sm !text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none"
          />
        ) : (
          /* Standard items: show auto-filled unit as read-only text */
          <span className="inline-block py-1 text-sm text-neutral-900">
            {fixedUnit || item.unit || "—"}
          </span>
        )}
      </td>
      <td className="border-r border-neutral-300 p-2 text-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxQty}
          name={`budgetItem_${index}_quantity`}
          value={item.quantity}
          onKeyDown={blockNonIntegerKeys}
          onChange={(e) =>
            onUpdate(
              item.id,
              "quantity",
              sanitizeIntegerInput(e.target.value).slice(0, maxQty)
            )
          }
          style={{ color: "#171717" }}
          className="w-full rounded border border-transparent bg-transparent py-1 text-center !text-neutral-900 focus:border-neutral-300 focus:bg-white focus:outline-none"
        />
      </td>
      <td className="border-r border-neutral-300 p-2">
        <div className="flex items-center justify-center gap-1">
          <span className="font-semibold text-neutral-500 select-none">₱</span>
          <input
            type="text"
            inputMode="decimal"
            maxLength={5}
            name={`budgetItem_${index}_pricePerUnit`}
            value={item.pricePerUnit}
            onKeyDown={blockNonDecimalKeys}
            onChange={(e) =>
              onUpdate(
                item.id,
                "pricePerUnit",
                sanitizeDecimalInput(e.target.value).slice(0, 5)
              )
            }
            style={{ color: "#171717" }}
            className="w-20 rounded border border-transparent bg-transparent py-1 text-center !text-neutral-900 focus:border-neutral-300 focus:bg-white focus:outline-none"
          />
        </div>
      </td>
      <td className="p-2 text-center font-medium !text-neutral-900">
        ₱{formatPeso(rowTotal)}
      </td>
      {canRemove ? (
        <td className="p-1 text-center">
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="cursor-pointer rounded p-1 text-neutral-400 transition-colors hover:text-red-600"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </button>
        </td>
      ) : null}
    </tr>
  )
})

export function BudgetProposalSection({
  items,
  grandTotal,
  onUpdate,
  onRemove,
  onAdd,
}: {
  items: BudgetItem[]
  grandTotal: number
  onUpdate: (id: string, field: keyof BudgetItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const canRemove = items.length > 1

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">
          Detailed Budget Proposal
        </h2>
        <p className="mt-0.5 text-sm font-medium text-neutral-600">
          Include all the Budget Proposal Needed
        </p>
      </div>

      <div className={layout.sectionFlush}>
        <div className={cn(layout.tableWrap, "overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0")}>
          <table className={cn("min-w-[600px] w-full border-collapse text-left text-sm", layout.table)}>
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold tracking-wider text-neutral-700 uppercase">
                <th className="w-[32%] border-r border-neutral-300 px-4 py-3 text-center">
                  Item
                </th>
                <th className="w-[14%] border-r border-neutral-300 px-3 py-3 text-center">
                  Unit
                </th>
                <th className="w-[14%] border-r border-neutral-300 px-3 py-3 text-center">
                  Quantity
                </th>
                <th className="w-[20%] border-r border-neutral-300 px-4 py-3 text-center">
                  Price per Unit (₱)
                </th>
                <th className="w-[16%] px-3 py-3 text-center">
                  Total (₱)
                </th>
                {canRemove ? <th className="w-[4%] px-1 py-3 text-center" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {items.map((item, index) => (
                <BudgetRow
                  key={item.id}
                  item={item}
                  index={index}
                  canRemove={canRemove}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ))}
              <tr className="border-t border-neutral-300 bg-neutral-50/90 font-semibold text-neutral-800">
                <td
                  colSpan={4}
                  className="border-r border-neutral-300 px-6 py-3 text-right font-bold"
                >
                  Grand Total
                </td>
                <td className="px-4 py-3 text-center font-bold !text-neutral-900">
                  ₱{formatPeso(grandTotal)}
                </td>
                {canRemove ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-neutral-400 hover:bg-neutral-100/50"
      >
        <PlusIcon className="h-4 w-4 text-neutral-600" />
        <span>Add more Item</span>
      </button>
    </div>
  )
}