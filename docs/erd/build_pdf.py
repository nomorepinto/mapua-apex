#!/usr/bin/env python3
"""
build_pdf.py - Convert the mapua-apex data-model docs (a Mermaid ERD + Markdown
files) into a single US-Letter (8.5 x 11 in) PDF.

The output is rendered through a headless Chromium (Playwright) so that:
  * the Mermaid diagram is drawn exactly as it appears in a browser, then
    auto-scaled to fit the page (no clipped visuals);
  * Markdown tables wrap inside their cells (no clipped text);
  * page size is a true 8.5 x 11 in via CSS `@page { size: letter }`.

The Mermaid ERD is authored top-down (graph TD) so it renders vertically.

------------------------------------------------------------------------
Setup (one time):
    pip install playwright markdown
    playwright install chromium

Usage:
    python build_pdf.py                       # uses files in this folder
    python build_pdf.py --out model.pdf       # custom output path
    python build_pdf.py --mermaid-js C:\\path\\to\\mermaid.min.js   # offline render
    python build_pdf.py erd.mmd objects.md access-patterns.md        # explicit order

Defaults (auto-discovered in --dir, which is this script's folder):
    Mermaid : every *.mmd (sorted)
    Markdown: objects.md, access-patterns.md, then any other *.md (sorted)
Output      : mapua-apex-data-model.pdf
"""

from __future__ import annotations

import argparse
import html
import sys
import tempfile
from datetime import datetime
from pathlib import Path

try:
    import markdown as _markdown
except ImportError:  # pragma: no cover
    _markdown = None

DEFAULT_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"

# Letter page geometry in CSS px (96 px == 1 in). Used to auto-fit the diagram.
PAGE_W_PX = int(8.5 * 96)          # 816
PAGE_H_PX = int(11 * 96)           # 1056
MARGIN_IN = 0.6
CONTENT_W_PX = int(PAGE_W_PX - 2 * MARGIN_IN * 96)   # ~700
# Leave headroom for the section heading above the diagram.
DIAGRAM_MAX_H_PX = int(PAGE_H_PX - 2 * MARGIN_IN * 96 - 70)


CSS = """
@page { size: letter; margin: %(margin)sin; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt; color: #111; line-height: 1.45;
}
h1 { font-size: 21pt; margin: 0 0 4px; color: #16213e;
     border-bottom: 3px solid #3b5bdb; padding-bottom: 6px; }
h2 { font-size: 15pt; margin: 20px 0 8px; color: #1a2a6c; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin: 14px 0 6px; color: #243; page-break-after: avoid; }
p, li { font-size: 10.5pt; }
.subtitle { color: #555; font-size: 10.5pt; margin: 0 0 2px; }
.meta { color: #888; font-size: 9pt; margin: 0; }
code { font-family: "Cascadia Code", "Segoe UI Mono", Consolas, monospace;
       background: #f2f4f8; padding: 1px 4px; border-radius: 3px; font-size: 9.3pt; }
pre code { display: block; padding: 10px; overflow-x: hidden; white-space: pre-wrap;
           word-break: break-word; }
table { border-collapse: collapse; width: 100%%; table-layout: fixed;
        margin: 10px 0; font-size: 9.3pt; page-break-inside: auto; }
th, td { border: 1px solid #c9d2e3; padding: 5px 7px; text-align: left;
         vertical-align: top; overflow-wrap: break-word; word-break: break-word; }
th { background: #eef2fb; font-weight: 600; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
blockquote { border-left: 4px solid #f0a500; margin: 10px 0; padding: 6px 12px;
             background: #fff8e6; color: #4a3b00; }
hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
a { color: #2b4acb; text-decoration: none; }
.doc-section { page-break-before: always; }
.diagram-section { page-break-before: always; page-break-inside: avoid; }
.diagram-wrap { text-align: center; page-break-inside: avoid; margin-top: 6px; }
.diagram-wrap svg { max-width: 100%% !important; height: auto !important; }
.mermaid { display: flex; justify-content: center; }
"""

RENDER_JS = """
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: { fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif', fontSize: '14px' },
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', nodeSpacing: 45, rankSpacing: 55 }
});
window.__renderDone = false;
window.__renderError = null;
function fitDiagrams() {
  document.querySelectorAll('.diagram-wrap').forEach(function (wrap) {
    var svg = wrap.querySelector('svg');
    if (!svg) return;
    var availW = wrap.clientWidth || %(content_w)d;
    var availH = Number(wrap.dataset.maxHeight || %(diag_h)d);
    var vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || !vb.width || !vb.height) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.maxWidth = 'none';
    var scale = Math.min(availW / vb.width, availH / vb.height);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    var w = Math.floor(vb.width * scale);
    var h = Math.floor(vb.height * scale);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
  });
}
(async function () {
  try {
    await mermaid.run({ querySelector: '.mermaid' });
    fitDiagrams();
  } catch (e) {
    window.__renderError = String(e && e.message ? e.message : e);
  }
  window.__renderDone = true;
})();
"""


def discover_files(directory: Path, explicit: list[str]) -> tuple[list[Path], list[Path]]:
    """Return (mermaid_files, markdown_files) in render order."""
    if explicit:
        mmd, md = [], []
        for name in explicit:
            p = Path(name)
            if not p.is_absolute():
                p = directory / p
            if not p.exists():
                sys.exit(f"[error] input file not found: {p}")
            (mmd if p.suffix.lower() == ".mmd" else md).append(p)
        return mmd, md

    mmd = sorted(directory.glob("*.mmd"))
    preferred = ["objects.md", "access-patterns.md"]
    md = [directory / n for n in preferred if (directory / n).exists()]
    md += sorted(p for p in directory.glob("*.md") if p not in md and p.name != Path(__file__).name)
    return mmd, md


def md_to_html(text: str) -> str:
    if _markdown is None:
        sys.exit(
            "[error] the 'markdown' package is required.\n"
            "        Install it with:  pip install markdown"
        )
    return _markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list", "md_in_html"],
    )


def build_html(mmd_files: list[Path], md_files: list[Path], title: str,
               mermaid_src: str) -> str:
    parts: list[str] = []

    # Cover / title block (no forced page break before it).
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    parts.append(
        f'<section class="cover"><h1>{html.escape(title)}</h1>'
        f'<p class="subtitle">DynamoDB single-table data model &mdash; conceptual ERD, '
        f'object dictionary, and access patterns.</p>'
        f'<p class="meta">Generated {stamp}</p></section>'
    )

    # Mermaid diagrams: each on its own page, vertically oriented, auto-fitted.
    for mmd in mmd_files:
        source = mmd.read_text(encoding="utf-8")
        parts.append(
            '<section class="diagram-section">'
            f"<h2>Conceptual ERD</h2>"
            f'<div class="diagram-wrap" data-max-height="{DIAGRAM_MAX_H_PX}">'
            f'<pre class="mermaid">{html.escape(source)}</pre>'
            "</div></section>"
        )

    # Markdown documents: each starts on a new page.
    for md in md_files:
        body = md_to_html(md.read_text(encoding="utf-8"))
        parts.append(f'<section class="doc-section">{body}</section>')

    css = CSS % {"margin": MARGIN_IN, "content_w": CONTENT_W_PX}
    # CSS uses literal %% for percent; content_w placeholder is unused in CSS but harmless.
    render_js = RENDER_JS % {"content_w": CONTENT_W_PX, "diag_h": DIAGRAM_MAX_H_PX}

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<style>{css}</style>
</head>
<body>
{''.join(parts)}
<script src="{mermaid_src}"></script>
<script>{render_js}</script>
</body>
</html>
"""


def render_pdf(html_str: str, out_path: Path, timeout_ms: int, keep_html: bool) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit(
            "[error] Playwright is required.\n"
            "        Install with:  pip install playwright\n"
            "        Then:        playwright install chromium"
        )

    tmp = Path(tempfile.gettempdir()) / "mapua_apex_erd.html"
    tmp.write_text(html_str, encoding="utf-8")
    if keep_html:
        debug = out_path.with_suffix(".html")
        debug.write_text(html_str, encoding="utf-8")
        print(f"[info] wrote intermediate HTML -> {debug}")

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            sys.exit(
                f"[error] could not launch Chromium: {exc}\n"
                "        Run:  playwright install chromium"
            )
        page = browser.new_page(viewport={"width": PAGE_W_PX, "height": PAGE_H_PX})
        page.goto(tmp.as_uri(), wait_until="networkidle")
        try:
            page.wait_for_function("window.__renderDone === true", timeout=timeout_ms)
        except Exception:  # noqa: BLE001
            print("[warn] timed out waiting for Mermaid to finish; rendering anyway.")
        err = page.evaluate("window.__renderError")
        if err:
            print(f"[warn] Mermaid reported an error: {err}")
        page.emulate_media(media="print")
        page.pdf(
            path=str(out_path),
            prefer_css_page_size=True,   # honor @page { size: letter }
            print_background=True,
            display_header_footer=False,
        )
        browser.close()


def main() -> None:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="Build a Letter-size PDF from the ERD + Markdown docs.")
    ap.add_argument("files", nargs="*", help="Explicit input files (.mmd / .md) in order.")
    ap.add_argument("--dir", default=str(here), help="Folder to auto-discover inputs (default: script folder).")
    ap.add_argument("--out", default=None, help="Output PDF path (default: <dir>/mapua-apex-data-model.pdf).")
    ap.add_argument("--title", default="mapua-apex Data Model", help="Document title on the cover.")
    ap.add_argument("--mermaid-js", default=None, help="Local mermaid.min.js for offline rendering.")
    ap.add_argument("--mermaid-cdn", default=DEFAULT_CDN, help="Mermaid CDN URL (used if --mermaid-js absent).")
    ap.add_argument("--timeout", type=int, default=60000, help="Mermaid render timeout in ms (default 60000).")
    ap.add_argument("--keep-html", action="store_true", help="Also write the intermediate .html next to the PDF.")
    args = ap.parse_args()

    directory = Path(args.dir).resolve()
    mmd_files, md_files = discover_files(directory, args.files)
    if not mmd_files and not md_files:
        sys.exit(f"[error] no .mmd or .md inputs found in {directory}")

    mermaid_src = Path(args.mermaid_js).resolve().as_uri() if args.mermaid_js else args.mermaid_cdn

    out_path = Path(args.out) if args.out else directory / "mapua-apex-data-model.pdf"
    out_path = out_path.resolve()

    print("[info] Mermaid files :", ", ".join(f.name for f in mmd_files) or "(none)")
    print("[info] Markdown files:", ", ".join(f.name for f in md_files) or "(none)")
    print("[info] Mermaid source:", mermaid_src)

    html_str = build_html(mmd_files, md_files, args.title, mermaid_src)
    render_pdf(html_str, out_path, args.timeout, args.keep_html)
    print(f"[done] wrote {out_path}")


if __name__ == "__main__":
    main()
