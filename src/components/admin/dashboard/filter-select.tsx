import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const FILTER_SELECT_CLASS =
  "h-10 min-w-0 rounded-xl border-neutral-200 bg-white text-sm font-semibold text-neutral-900"

type FilterOption = { value: string; label: string }

export function FilterSelect({
  id,
  items,
  onValueChange,
  value,
}: {
  id: string
  items: readonly FilterOption[]
  onValueChange: (value: string) => void
  value: string
}) {
  const selected = items.find((item) => item.value === value) ?? null

  return (
    <Select
      itemToStringValue={(item) => item.value}
      items={items}
      onValueChange={(item) => onValueChange(item?.value ?? "")}
      value={selected}
    >
      <SelectTrigger id={id} className={FILTER_SELECT_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup className="bg-white text-neutral-900">
        {items.map((item) => (
          <SelectItem
            key={item.value || "all"}
            value={item}
            className="text-neutral-900 data-highlighted:bg-neutral-100 data-highlighted:text-neutral-900"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}

export const FILTER_LABEL_CLASS =
  "flex w-full flex-col gap-1 text-xs font-bold text-neutral-500 sm:w-44"
