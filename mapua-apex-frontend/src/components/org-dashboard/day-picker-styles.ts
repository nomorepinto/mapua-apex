export const DAY_PICKER_STYLES = {
  root: "w-full font-sans relative",
  months: "flex flex-col space-y-4",
  month: "w-full",
  month_caption: "flex items-center pt-1 mb-5 h-8",
  caption_label: "text-[15px] font-bold text-[#1E293B]",
  nav: "absolute right-12 top-0 flex items-center gap-1.5 z-10",
  button_previous:
    "size-11 sm:size-7 rounded-full bg-neutral-50 text-[#1E293B] flex items-center justify-center hover:bg-neutral-100 hover:shadow-sm transition-all border border-neutral-100/50 cursor-pointer",
  button_next:
    "size-11 sm:size-7 rounded-full bg-neutral-50 text-[#1E293B] flex items-center justify-center hover:bg-neutral-100 hover:shadow-sm transition-all border border-neutral-100/50 cursor-pointer",
  month_grid: "w-full min-w-0 border-collapse",
  weekdays: "flex w-full mb-2 justify-between gap-0.5",
  weekday:
    "text-neutral-600 rounded-md flex-1 min-w-0 max-w-10 font-semibold text-[11px] uppercase text-center",
  week: "flex w-full mt-1.5 justify-between gap-0.5",
  day: "flex-1 min-w-0 max-w-10 aspect-square p-0 flex items-center justify-center relative",
  day_button:
    "size-[min(2.25rem,100%)] rounded-full flex items-center justify-center font-medium text-[13px] text-[#1E293B] hover:bg-neutral-100 transition-colors cursor-pointer outline-none",
  selected:
    "!bg-neutral-100 !border !border-neutral-300 !text-[#1E293B] !font-bold",
  today: "!bg-red-50 !text-[#D9291C] !font-bold !border !border-red-200/60",
  outside: "text-neutral-300 opacity-50 cursor-default hover:bg-transparent",
  disabled: "text-neutral-300 opacity-50",
  hidden: "invisible",
}
