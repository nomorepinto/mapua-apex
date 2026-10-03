import { useNewEventForm } from "@/hooks/use-new-event-form"
import { DatePicker } from "@/components/ui/date-picker"
import { layout, modal } from "@/config"
import { minEventDateKey } from "@/lib/date-key"
import { cn } from "@/lib/utils"

interface NewEventModalProps {
  isOpen: boolean
  onClose: () => void
  defaultDate?: Date
}

export function NewEventModal({ isOpen, onClose, defaultDate }: NewEventModalProps) {
  const { title, setTitle, date, setDate, canSubmit, handleSubmit } =
    useNewEventForm(defaultDate, onClose)

  if (!isOpen) return null

  return (
    <div className={cn(modal.overlay, "z-[60] font-sans")}>
      <div className={cn(modal.shell, modal.sm, "h-[90dvh] bg-[#F2F2F7] sm:h-auto")}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200/60 bg-white p-4">
          <button
            onClick={onClose}
            type="button"
            className="min-h-11 px-1 text-[17px] text-[#D9291C] transition-opacity hover:opacity-70"
          >
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold text-black">New Event</h2>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-11 px-1 text-[17px] font-semibold text-[#D9291C] transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Add
          </button>
        </div>

        <div className={cn("flex flex-1 flex-col overflow-y-auto p-4", layout.stack, "!gap-6")}>
          <div className="bg-white rounded-xl overflow-hidden">
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full text-[17px] text-black placeholder:text-neutral-400 px-4 py-3 focus:outline-none border-b border-neutral-100"
              autoFocus
            />
          </div>

          <div className="bg-white rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[17px] text-black">Date</span>
              <div className="w-[11.5rem]">
                <DatePicker
                  value={date}
                  onChange={setDate}
                  minDate={minEventDateKey()}
                  placeholder="Pick a date"
                  aria-label="Event date"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
