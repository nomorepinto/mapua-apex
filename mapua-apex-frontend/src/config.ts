/**
 * Shared Tailwind tokens for every layout surface.
 * Grey page canvas, white rounded cards, 1rem gaps — mobile-first.
 */
export const colors = {
  page: "#F5F6F8",
  maroon: "#8B0000",
  maroonHover: "#6B0000",
  gold: "#FBC02D",
} as const

/** Institutional yes — Approve, Continue, Submit, Create. */
export const brand = {
  action:
    "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#8B0000] px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#6B0000] disabled:pointer-events-none disabled:opacity-50",
  actionGhost:
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50",
  chip: "rounded-sm bg-[#8B0000] px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase",
  chipGold:
    "rounded-sm bg-[#FBC02D] px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-[#5C4300] uppercase",
} as const

export const layout = {
  /** Full-page grey canvas. */
  page: "min-h-full w-full min-w-0 overflow-x-clip bg-page p-4 text-neutral-900 sm:p-6 lg:p-8",
  /** Sidebar shell behind <main>. */
  frame: "flex h-dvh w-full flex-col overflow-hidden bg-page lg:flex-row",
  /** Scrollable main column next to the sidebar. */
  main: "min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto",
  fallback:
    "flex min-h-dvh w-full items-center justify-center bg-page text-sm font-medium text-neutral-600",
  center: "flex min-h-dvh w-full items-center justify-center bg-page p-4",
  /** Space between page sections. */
  stack: "flex flex-col gap-4",
  gap: "gap-4",
  container: "mx-auto w-full max-w-6xl",
  containerNarrow: "mx-auto w-full max-w-xl",

  /** White section with padding. */
  section: "border-1 border-neutral-300 rounded-2xl bg-white p-4 shadow-xs sm:p-6 md:p-7",
  /** White table/panel wrapper with no inner padding. */
  sectionFlush: "border-1 border-neutral-300 overflow-hidden rounded-2xl bg-white shadow-xs",
  /** Override for shadcn/coss Card (drops its default border). */
  card: "border-1 border-neutral-300 bg-white shadow-xs",

  pageHeader: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
  pageTitle: "text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl",
  pageSubtitle: "mt-0.5 text-sm text-neutral-500",

  grid2: "grid grid-cols-1 md:grid-cols-2",
  grid3: "grid grid-cols-1 items-start xl:grid-cols-3",
  gridAuto: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  grid4: "grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",

  tableWrap: "w-full min-w-0 overflow-x-auto",
  table: "w-full min-w-[36rem]",
  tableWide: "w-full min-w-[54rem]",

  empty: "flex flex-col items-center justify-center rounded-xl bg-[#F8FAFC] p-8 text-center",
  actions: "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
  actionRow: "flex flex-col gap-3 sm:flex-row sm:items-center",
  touch: "inline-flex min-h-11 min-w-11 items-center justify-center",
} as const

/**
 * Overlay shells used by custom modals (not coss Dialog internals).
 * Bottom-sheet on mobile, centered card from sm up.
 */
export const modal = {
  overlay:
    "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs animate-in fade-in duration-200 sm:items-center sm:p-6",
  overlayCenter:
    "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200 sm:p-6",
  shell:
    "flex w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:rounded-2xl",
  sm: "max-h-[90dvh] sm:max-w-md",
  md: "max-h-[90dvh] sm:max-w-lg",
  lg: "max-h-[90dvh] sm:max-w-2xl",
  xl: "max-h-[90dvh] sm:max-w-4xl",
  full: "h-[90dvh] max-h-[90dvh] sm:max-w-6xl",
  tall: "h-[90dvh] max-h-[90dvh]",
  header:
    "flex shrink-0 flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8 md:py-5",
  body: "min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-page px-4 py-4 sm:px-6 sm:py-6 md:px-8",
  footer:
    "flex shrink-0 flex-col-reverse gap-3 border-t border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8",
  close:
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600",
  dialog: "flex max-h-[90dvh] w-full min-w-0 flex-col",
  dialogMd: "flex max-h-[90dvh] w-full min-w-0 max-w-lg flex-col",
  dialogLg: "flex max-h-[90dvh] w-full min-w-0 max-w-2xl flex-col",
  dialogXl: "flex max-h-[90dvh] w-full min-w-0 max-w-4xl flex-col",
  popoverOverlay:
    "fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-start sm:justify-end sm:p-3 sm:pr-8 sm:pt-20",
  popoverShell:
    "relative w-full max-h-[85dvh] overflow-hidden rounded-t-2xl border border-neutral-100 bg-white shadow-2xl sm:max-h-[min(28rem,70dvh)] sm:w-96 sm:rounded-2xl",
} as const
