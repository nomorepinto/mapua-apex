import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { ApiCampusDepartment } from "@/lib/types"

/** Editable department row (C-1): code + name with nested course rows. */
export interface CampusCourseDraft {
  code: string
  name: string
}

export interface CampusDepartmentDraft {
  code: string
  name: string
  courses: CampusCourseDraft[]
}

export const MAX_CAMPUS_DEPARTMENTS = 50
export const MAX_DEPARTMENT_COURSES = 100

export function emptyDepartmentDraft(): CampusDepartmentDraft {
  return { code: "", name: "", courses: [] }
}

export function emptyCourseDraft(): CampusCourseDraft {
  return { code: "", name: "" }
}

/** Seed editor rows from the stored campus master data. */
export function departmentsToDrafts(
  departments: ApiCampusDepartment[] | undefined
): CampusDepartmentDraft[] {
  return (departments ?? []).map((department) => ({
    code: department.code,
    name: department.name,
    courses: (department.courses ?? []).map((course) => ({
      code: course.code,
      name: course.name,
    })),
  }))
}

const isBlank = (value: string) => value.trim() === ""

/**
 * Resolve draft rows into the API payload, mirroring the backend rules:
 * fully blank rows are dropped, partially filled rows are rejected, and
 * department/course codes must be unique (case-insensitive).
 */
export function resolveDepartments(drafts: CampusDepartmentDraft[]): {
  departments: ApiCampusDepartment[]
  error: string
} {
  const departments: ApiCampusDepartment[] = []
  const seenDepartments = new Set<string>()

  for (const draft of drafts) {
    const code = draft.code.trim()
    const name = draft.name.trim()
    const courses: { code: string; name: string }[] = []
    const seenCourses = new Set<string>()

    for (const course of draft.courses) {
      const courseCode = course.code.trim()
      const courseName = course.name.trim()
      if (isBlank(courseCode) && isBlank(courseName)) {
        continue
      }
      if (isBlank(courseCode) || isBlank(courseName)) {
        return {
          departments: [],
          error: "Each course needs both a code and a name.",
        }
      }
      const courseKey = courseCode.toUpperCase()
      if (seenCourses.has(courseKey)) {
        return {
          departments: [],
          error: `Duplicate course code "${courseCode}" in department "${code || name}".`,
        }
      }
      seenCourses.add(courseKey)
      courses.push({ code: courseCode, name: courseName })
    }

    if (isBlank(code) && isBlank(name) && courses.length === 0) {
      continue
    }
    if (isBlank(code) || isBlank(name)) {
      return {
        departments: [],
        error: "Each department needs both a code and a name.",
      }
    }
    const key = code.toUpperCase()
    if (seenDepartments.has(key)) {
      return {
        departments: [],
        error: `Duplicate department code "${code}" on this campus.`,
      }
    }
    seenDepartments.add(key)
    departments.push({ code, name, courses })
  }

  if (departments.length > MAX_CAMPUS_DEPARTMENTS) {
    return {
      departments: [],
      error: `A campus can have at most ${MAX_CAMPUS_DEPARTMENTS} departments.`,
    }
  }
  if (departments.some((d) => (d.courses ?? []).length > MAX_DEPARTMENT_COURSES)) {
    return {
      departments: [],
      error: `A department can have at most ${MAX_DEPARTMENT_COURSES} courses.`,
    }
  }
  return { departments, error: "" }
}

interface CampusDepartmentsEditorProps {
  value: CampusDepartmentDraft[]
  onChange: (next: CampusDepartmentDraft[]) => void
  /** Unique input-id prefix so add + edit forms never share ids. */
  idPrefix: string
}

/**
 * Repeatable department code+name rows, each with nested course code+name
 * rows (C-1). Used by both the Add campus card and the Edit campus dialog.
 */
export function CampusDepartmentsEditor({
  value,
  onChange,
  idPrefix,
}: CampusDepartmentsEditorProps) {
  function patchDepartment(index: number, patch: Partial<CampusDepartmentDraft>) {
    onChange(
      value.map((department, i) =>
        i === index ? { ...department, ...patch } : department
      )
    )
  }

  function patchCourse(
    departmentIndex: number,
    courseIndex: number,
    patch: Partial<CampusCourseDraft>
  ) {
    const department = value[departmentIndex]
    if (!department) return
    patchDepartment(departmentIndex, {
      courses: department.courses.map((course, i) =>
        i === courseIndex ? { ...course, ...patch } : course
      ),
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Departments &amp; courses</p>
        <p className="text-xs text-muted-foreground">
          Optional. The departments and courses offered at this campus.
          Proponents pick their campus, then a department, then a program from
          this list.
        </p>
      </div>
      {value.map((department, departmentIndex) => (
        <div
          className="flex flex-col gap-3 rounded-lg border p-3"
          key={`${idPrefix}-dept-${departmentIndex}`}
        >
          <div className="flex items-end gap-2">
            <Field className="w-32 shrink-0">
              <FieldLabel htmlFor={`${idPrefix}-dept-code-${departmentIndex}`}>
                Code
              </FieldLabel>
              <Input
                autoComplete="off"
                id={`${idPrefix}-dept-code-${departmentIndex}`}
                maxLength={50}
                onChange={(event) =>
                  patchDepartment(departmentIndex, {
                    code: event.currentTarget.value,
                  })
                }
                placeholder="EECE"
                type="text"
                value={department.code}
              />
            </Field>
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`${idPrefix}-dept-name-${departmentIndex}`}>
                Department name
              </FieldLabel>
              <Input
                autoComplete="off"
                id={`${idPrefix}-dept-name-${departmentIndex}`}
                maxLength={200}
                onChange={(event) =>
                  patchDepartment(departmentIndex, {
                    name: event.currentTarget.value,
                  })
                }
                placeholder="Electrical, Electronics and Computer Engineering"
                type="text"
                value={department.name}
              />
            </Field>
            <Button
              aria-label={`Remove department ${departmentIndex + 1}`}
              onClick={() =>
                onChange(value.filter((_, i) => i !== departmentIndex))
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2Icon />
            </Button>
          </div>
          <div className="flex flex-col gap-2 pl-2">
            {department.courses.map((course, courseIndex) => (
              <div
                className="flex items-end gap-2"
                key={`${idPrefix}-course-${departmentIndex}-${courseIndex}`}
              >
                <Field className="w-32 shrink-0">
                  <FieldLabel
                    htmlFor={`${idPrefix}-course-code-${departmentIndex}-${courseIndex}`}
                  >
                    Course code
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    id={`${idPrefix}-course-code-${departmentIndex}-${courseIndex}`}
                    maxLength={50}
                    onChange={(event) =>
                      patchCourse(departmentIndex, courseIndex, {
                        code: event.currentTarget.value,
                      })
                    }
                    placeholder="BSCpE"
                    type="text"
                    value={course.code}
                  />
                </Field>
                <Field className="min-w-0 flex-1">
                  <FieldLabel
                    htmlFor={`${idPrefix}-course-name-${departmentIndex}-${courseIndex}`}
                  >
                    Course name
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    id={`${idPrefix}-course-name-${departmentIndex}-${courseIndex}`}
                    maxLength={200}
                    onChange={(event) =>
                      patchCourse(departmentIndex, courseIndex, {
                        name: event.currentTarget.value,
                      })
                    }
                    placeholder="BS Computer Engineering"
                    type="text"
                    value={course.name}
                  />
                </Field>
                <Button
                  aria-label={`Remove course ${courseIndex + 1}`}
                  onClick={() =>
                    patchDepartment(departmentIndex, {
                      courses: department.courses.filter(
                        (_, i) => i !== courseIndex
                      ),
                    })
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                patchDepartment(departmentIndex, {
                  courses: [...department.courses, emptyCourseDraft()],
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <PlusIcon aria-hidden="true" />
              Add course
            </Button>
          </div>
        </div>
      ))}
      <Button
        onClick={() => onChange([...value, emptyDepartmentDraft()])}
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden="true" />
        Add department
      </Button>
    </div>
  )
}