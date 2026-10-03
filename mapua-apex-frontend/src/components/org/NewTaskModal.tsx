import { useNewTaskForm } from "@/hooks/use-new-task-form"
import { DatePicker } from "@/components/ui/date-picker"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewTaskModal({ isOpen, onClose }: NewTaskModalProps) {
  const {
    title,
    setTitle,
    responsible,
    setResponsible,
    dueDate,
    setDueDate,
    canSubmit,
    handleSubmit,
  } = useNewTaskForm(onClose)

  if (!isOpen) return null

  return (
    <div className={cn(modal.overlayCenter, "z-[60]")}>
      <div className={cn(modal.shell, modal.sm)}>
        <div className={modal.header}>
          <h2 className="text-lg font-bold text-[#1E293B]">New Task</h2>
          <button
            onClick={onClose}
            type="button"
            className={modal.close}
            aria-label="Close new task"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 sm:p-6">
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">Task Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Complete security audit"
              className="w-full bg-[#F8FAFC] border border-neutral-200 rounded-xl text-sm text-[#1E293B] placeholder:text-neutral-400 px-4 py-2.5 focus:outline-none focus:border-[#D9291C] focus:ring-1 focus:ring-[#D9291C]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">Responsible Person/Team</label>
            <input 
              type="text" 
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="E.g., Benedict V. (Events Head)"
              className="w-full bg-[#F8FAFC] border border-neutral-200 rounded-xl text-sm text-[#1E293B] placeholder:text-neutral-400 px-4 py-2.5 focus:outline-none focus:border-[#D9291C] focus:ring-1 focus:ring-[#D9291C]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold tracking-wider text-neutral-600 uppercase">
              Due Date (Optional)
            </label>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Pick a due date"
              aria-label="Task due date"
            />
          </div>

          <div className={cn(layout.actions, "mt-2")}>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-[#64748B] transition-colors hover:bg-neutral-100 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-11 w-full rounded-xl bg-[#D9291C] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
