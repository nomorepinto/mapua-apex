import { memo, useState } from "react"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { POST_EVAL_AMOUNT_MAX_DIGITS } from "@/components/posteval/constants"
import type {
  PostEvalAddedItem,
  PostEvalBudgetItem,
} from "@/components/posteval/types"
import {
  BUDGET_OPTIONS,
  QUANTITY_MAX_MAP,
  UNIT_MAP,
} from "@/components/submission/budget-options"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import {
  blockNonDecimalKeys,
  blockNonIntegerKeys,
  calculateRowTotal,
  formatPeso,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import { cn } from "@/lib/utils"

/** Compact peso input shared by the budget and added-item rows. */
function ActualAmountInput({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span className="select-none font-semibold text-neutral-500">₱</span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        maxLength={POST_EVAL_AMOUNT_MAX_DIGITS}
        value={value}
        placeholder="0"
        onKeyDown={blockNonDecimalKeys}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: "#171717" }}
        className="w-20 rounded border border-transparent bg-transparent py-1 text-center !text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none"
      />
    </div>
  )
}

const AddedItemRow = memo(function AddedItemRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: PostEvalAddedItem
  index: number
  onUpdate: (id: string, field: keyof PostEvalAddedItem, value: string) => void
  onRemove: (id: string) => void
}) {
  const [isCustomItem, setIsCustomItem] = useState(() => {
    return Boolean(
      item.item && !BUDGET_OPTIONS.includes(item.item) && item.item !== "Others"
    )
  })

  const isOthersItem = item.item === "Others" || isCustomItem
  const maxQty = QUANTITY_MAX_MAP[item.item] || 3
  const fixedUnit = !isOthersItem ? UNIT_MAP[item.item] : undefined
  const rowTotal = calculateRowTotal(item.quantity, item.pricePerUnit)

  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="border-r border-neutral-300 p-2 text-center">
        {isCustomItem ? (
          <div className="relative flex items-center">
            <input
              type="text"
              name={`addedItem_${index}_name`}
              value={item.item}
              maxLength={25}
              placeholder="Enter custom item..."
              style={{ color: "#171717" }}
              onChange={(e) => onUpdate(item.id, "item", e.target.value)}
              className="w-full rounded border border-transparent bg-transparent py-1 pl-3 pr-8 text-center text-sm !text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none"
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
                onUpdate(item.id, "unit", UNIT_MAP[val ?? ""] ?? "")
                const newMax = QUANTITY_MAX_MAP[val ?? ""] || 3
                if (item.quantity.length > newMax) {
                  onUpdate(item.id, "quantity", item.quantity.slice(0, newMax))
                }
              }
            }}
          >
            <SelectTrigger className="h-8 w-full border-transparent bg-transparent shadow-none hover:bg-neutral-100 focus:border-neutral-300 focus:bg-white">
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
          <input
            type="text"
            maxLength={5}
            name={`addedItem_${index}_unit`}
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
          name={`addedItem_${index}_quantity`}
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
          <span className="select-none font-semibold text-neutral-500">₱</span>
          <input
            type="text"
            inputMode="decimal"
            maxLength={POST_EVAL_AMOUNT_MAX_DIGITS}
            name={`addedItem_${index}_pricePerUnit`}
            value={item.pricePerUnit}
            onKeyDown={blockNonDecimalKeys}
            onChange={(e) =>
              onUpdate(
                item.id,
                "pricePerUnit",
                sanitizeDecimalInput(e.target.value).slice(
                  0,
                  POST_EVAL_AMOUNT_MAX_DIGITS
                )
              )
            }
            style={{ color: "#171717" }}
            className="w-20 rounded border border-transparent bg-transparent py-1 text-center !text-neutral-900 focus:border-neutral-300 focus:bg-white focus:outline-none"
          />
        </div>
      </td>
      <td className="border-r border-neutral-300 p-2">
        <ActualAmountInput
          name={`addedItem_${index}_actualAmount`}
          value={item.actualAmount}
          onChange={(value) => onUpdate(item.id, "actualAmount", value)}
        />
      </td>
      <td className="p-2 text-center font-medium !text-neutral-900">
        ₱{formatPeso(rowTotal)}
      </td>
      <td className="p-1 text-center">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="cursor-pointer rounded p-1 text-neutral-400 transition-colors hover:text-red-600"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
})

/**
 * Section 2 — the approved budget (read-only, seeded from the linked submission)
 * against what was actually spent, plus any extra expenses added after the fact.
 * Grand totals are derived, never typed.
 */
export function FinancialReportSection({
  budgetItems,
  addedItems,
  initialGrandTotal,
  actualGrandTotal,
  isLoading,
  onUpdateBudgetActual,
  onAddItem,
  onRemoveItem,
  onUpdateAddedItem,
}: {
  budgetItems: PostEvalBudgetItem[]
  addedItems: PostEvalAddedItem[]
  initialGrandTotal: number
  actualGrandTotal: number
  isLoading: boolean
  onUpdateBudgetActual: (id: string, value: string) => void
  onAddItem: () => void
  onRemoveItem: (id: string) => void
  onUpdateAddedItem: (
    id: string,
    field: keyof PostEvalAddedItem,
    value: string
  ) => void
}) {
  return (
    <div className="space-y-4 pt-4">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">Financial Report</h2>
        <p className="mt-0.5 text-sm font-medium text-neutral-600">
          Compare the approved budget against the actual amount spent, and record
          any additional expenses.
        </p>
      </div>

      {/* Initial budget vs. actual spend */}
      <div className={layout.sectionFlush}>
        <div
          className={cn(
            layout.tableWrap,
            "overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
          )}
        >
          <table
            className={cn(
              "min-w-[560px] w-full border-collapse text-left text-sm",
              layout.table
            )}
          >
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                <th className="w-[36%] border-r border-neutral-300 px-4 py-3 text-center">
                  Item
                </th>
                <th className="w-[12%] border-r border-neutral-300 px-3 py-3 text-center">
                  Unit
                </th>
                <th className="w-[12%] border-r border-neutral-300 px-3 py-3 text-center">
                  Qty
                </th>
                <th className="w-[20%] border-r border-neutral-300 px-3 py-3 text-center">
                  Budgeted (₱)
                </th>
                <th className="w-[20%] px-3 py-3 text-center">Actual (₱)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    Loading approved budget…
                  </td>
                </tr>
              ) : budgetItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No initial budget was recorded for this event.
                  </td>
                </tr>
              ) : (
                budgetItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-neutral-50/60">
                    <td className="border-r border-neutral-300 px-4 py-2 text-center !text-neutral-900">
                      {item.item}
                    </td>
                    <td className="border-r border-neutral-300 px-3 py-2 text-center text-neutral-700">
                      {item.unit || "—"}
                    </td>
                    <td className="border-r border-neutral-300 px-3 py-2 text-center text-neutral-700">
                      {item.quantity || "—"}
                    </td>
                    <td className="border-r border-neutral-300 px-3 py-2 text-center text-neutral-700">
                      ₱{formatPeso(Number(item.budgetedTotal) || 0)}
                    </td>
                    <td className="px-3 py-2">
                      <ActualAmountInput
                        name={`budgetItem_${index}_actualAmount`}
                        value={item.actualAmount}
                        onChange={(value) =>
                          onUpdateBudgetActual(item.id, value)
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional expenses */}
      <div>
        <h3 className="text-base font-bold text-neutral-900">
          Additional Expenses
        </h3>
        <p className="mt-0.5 text-sm font-medium text-neutral-600">
          Add any expense not present in the approved budget.
        </p>
      </div>

      <div className={layout.sectionFlush}>
        <div
          className={cn(
            layout.tableWrap,
            "overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
          )}
        >
          <table
            className={cn(
              "min-w-[640px] w-full border-collapse text-left text-sm",
              layout.table
            )}
          >
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                <th className="w-[26%] border-r border-neutral-300 px-4 py-3 text-center">
                  Item
                </th>
                <th className="w-[12%] border-r border-neutral-300 px-3 py-3 text-center">
                  Unit
                </th>
                <th className="w-[10%] border-r border-neutral-300 px-3 py-3 text-center">
                  Qty
                </th>
                <th className="w-[16%] border-r border-neutral-300 px-3 py-3 text-center">
                  Price/Unit (₱)
                </th>
                <th className="w-[16%] border-r border-neutral-300 px-3 py-3 text-center">
                  Actual (₱)
                </th>
                <th className="w-[16%] border-r border-neutral-300 px-3 py-3 text-center">
                  Total (₱)
                </th>
                <th className="w-[4%] px-1 py-3 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {addedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No additional expenses added.
                  </td>
                </tr>
              ) : (
                addedItems.map((item, index) => (
                  <AddedItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    onUpdate={onUpdateAddedItem}
                    onRemove={onRemoveItem}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddItem}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-neutral-400 hover:bg-neutral-100/50"
      >
        <PlusIcon className="h-4 w-4 text-neutral-600" />
        <span>Add item</span>
      </button>

      {/* Derived totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Initial Grand Total
          </p>
          <p className="mt-1 text-lg font-bold !text-neutral-900">
            ₱{formatPeso(initialGrandTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-[#8B0000]/30 bg-[#8B0000]/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B0000]">
            Actual Grand Total
          </p>
          <p className="mt-1 text-lg font-bold text-[#8B0000]">
            ₱{formatPeso(actualGrandTotal)}
          </p>
        </div>
      </div>
    </div>
  )
}
