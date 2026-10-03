import { FileSpreadsheetIcon } from "lucide-react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function CsvFileField({
  id,
  description,
  fileName,
  error,
  onFile,
}: {
  id: string
  description: string
  fileName?: string
  error?: string
  onFile: (file: File | null, text: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>CSV import</FieldLabel>
      <Input
        accept=".csv,text/csv"
        aria-invalid={error ? true : undefined}
        id={id}
        name={id}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0] ?? null
          if (!file) {
            onFile(null, "")
            return
          }
          const text = await file.text()
          onFile(file, text)
          event.currentTarget.value = ""
        }}
        type="file"
      />
      <FieldDescription>
        {fileName ? (
          <span className="inline-flex items-center gap-1.5">
            <FileSpreadsheetIcon aria-hidden="true" className="size-3.5" />
            {fileName} — {description}
          </span>
        ) : (
          description
        )}
      </FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
