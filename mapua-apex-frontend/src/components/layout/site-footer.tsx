import { Bug } from "lucide-react"

/**
 * Slim, ever-present footer pinned to the bottom of the viewport so it is
 * visible on every screen. Carries the bug-report entry point as a plain
 * mailto link.
 *
 * Positioning rules:
 * - It is a normal in-flow strip, NOT a `fixed` overlay. `layout.frame` (and
 *   the other full-height shells) end at `calc(100dvh - var(--site-footer-h))`,
 *   so this bar owns the remaining strip and page content can never be painted
 *   over by it. A `fixed` bar covered the bottom of the scrollable main column
 *   and every scrolling page (the sidebar offset trick only worked below `lg`).
 * - Rendered as the last child of `#root` (see main.tsx), full width, so it
 *   also sits below the desktop sidebar column.
 */
export function SiteFooter() {
  return (
    <footer className="flex h-[var(--site-footer-h)] shrink-0 items-center justify-center gap-2 border-t border-[#8B0000] bg-neutral-900 px-4 text-xs text-neutral-300">
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
