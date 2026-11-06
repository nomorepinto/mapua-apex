import { Bug } from "lucide-react"

/**
 * Slim, ever-present footer fixed to the bottom of the viewport so it is
 * visible on every screen and never scrolls away. Carries the bug-report
 * entry point as a plain mailto link. Space for it is reserved by
 * `--site-footer-h` (see index.css and `layout.frame` in config.ts).
 *
 * Stacking/positioning rules:
 * - On desktop it starts after the sidebar column (`lg:left-64` matches the
 *   `w-64` AppSidebar), so it only ever covers the bottom of the main page.
 * - z-20 (not z-30): it must never paint above the sticky mobile header
 *   (AppSidebar header is z-30), and the desktop sidebar column is z-20 —
 *   the left offset removes the overlap, the lowered z-index is the safety net.
 */
export function SiteFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 flex h-[var(--site-footer-h)] items-center justify-center gap-2 border-t border-[#8B0000] bg-neutral-900 px-4 text-xs text-neutral-300 lg:left-64">
      <Bug className="h-3.5 w-3.5 shrink-0 text-[#FBC02D]" />
      <span>
        Email{" "}
        <a
          href="mailto:mapuaapex@gmail.com"
          className="font-medium text-white underline underline-offset-2 transition-colors hover:text-[#FBC02D]"
        >
          mapuaapex@gmail.com
        </a>{" "}
        for bug reports
      </span>
    </footer>
  )
}
