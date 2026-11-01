export type CsvCell = string | number | boolean | null | undefined

export function csvContent(headers: string[], rows: CsvCell[][]): string {
  const escape = (cell: CsvCell): string => {
    if (cell === null || cell === undefined) return '""'
    let text = String(cell)
    // Control-prefixed spreadsheet formulas must be treated as literal text.
    // eslint-disable-next-line no-control-regex
    const unsafePrefix = /^[\x00-\x20]*[=+\-@]|^[\x00-\x1f\x7f]/
    if (typeof cell === "string" && unsafePrefix.test(text)) text = "'" + text
    return `"${text.replace(/"/g, '""')}"`
  }
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") +
    "\r\n"
  )
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const blob = new Blob([csvContent(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
