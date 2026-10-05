import { TABLE_INPUT_CLASS } from "@/components/reservation/constants"
import {
  classroomExampleFor,
  classroomFormatFor,
  isValidClassroomName,
} from "@/lib/campus-rooms"
import { cn } from "@/lib/utils"

/**
 * Classroom code input for a "Classroom" room row.
 *
 * Codes follow the venue campus format, so a code that does not match shows a
 * small red warning with the expected format. The wizard also refuses to
 * continue or submit while any classroom code is missing or invalid.
 */
export function ClassroomInput({
  value,
  campus,
  onChange,
}: {
  value: string
  campus: string
  onChange: (value: string) => void
}) {
  const invalid = value.length > 0 && !isValidClassroomName(campus, value)

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        maxLength={6}
        required
        placeholder={classroomExampleFor(campus) || "Classroom code"}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: "#171717" }}
        className={cn(
          TABLE_INPUT_CLASS,
          "placeholder:text-neutral-400",
          // An empty code is caught by native `:invalid` once the wizard
          // reveals errors; a wrongly formatted one needs the explicit glow so
          // the reveal/focus sweep can find it too.
          invalid &&
            "saaf-glow-invalid border-red-400 bg-red-50/60 focus:border-red-400"
        )}
      />
      {invalid ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          Format: {classroomFormatFor(campus)}
        </p>
      ) : null}
    </div>
  )
}
