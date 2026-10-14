/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { use } from "react"

import { toastBulkResult } from "@/components/admin/organizations/organization-desks"
import { toastManager } from "@/components/ui/toast"
import {
  useAdminCampusesQuery,
  useBulkCreateCampusesMutation,
  useCreateCampusMutation,
  useDeleteCampusMutation,
  useUpdateCampusMutation,
} from "@/hooks/use-campuses"
import {
  MAX_PREFIXES,
  isValidPrefixToken,
  parsePrefixTokens,
} from "@/lib/campus-classroom-format"
import { parseSingleColumnCsv } from "@/lib/parse-csv"
import type { ApiCampus, CreateCampusPayload } from "@/lib/types"

const EMPTY_CAMPUSES: ApiCampus[] = []

/**
 * Resolve the optional classroom name format from raw text inputs, enforcing the
 * paired rule (prefixes require a digit count and vice-versa) plus per-token and
 * range validation. Mirrors the backend `StoreCampusRequest` rules so a bad
 * format is caught before hitting the API. An all-blank pair means "no rule".
 */
function resolveClassroomFormat(
  prefixesText: string,
  digitsText: string
): { payload: Pick<CreateCampusPayload, "classroom_name_prefixes" | "classroom_name_digits">; error: string } {
  const prefixes = parsePrefixTokens(prefixesText)
  const trimmedDigits = digitsText.trim()
  const hasPrefixes = prefixes.length > 0
  const hasDigits = trimmedDigits !== ""

  if (!hasPrefixes && !hasDigits) {
    return { payload: {}, error: "" }
  }
  if (hasPrefixes && !hasDigits) {
    return { payload: {}, error: "Add a digit count to complete the classroom name format." }
  }
  if (!hasPrefixes && hasDigits) {
    return { payload: {}, error: "Add at least one prefix token to complete the classroom name format." }
  }

  const invalid = prefixes.find((token) => !isValidPrefixToken(token))
  if (invalid) {
    return { payload: {}, error: `Classroom prefix "${invalid}" must be 1-10 letters.` }
  }
  if (prefixes.length > MAX_PREFIXES) {
    return { payload: {}, error: `A campus can allow at most ${MAX_PREFIXES} prefix tokens.` }
  }

  const digits = Number(trimmedDigits)
  if (!Number.isInteger(digits) || digits < 1 || digits > 4) {
    return { payload: {}, error: "Classroom digit count must be a whole number from 1 to 4." }
  }

  return {
    payload: { classroom_name_prefixes: prefixes, classroom_name_digits: digits },
    error: "",
  }
}

interface CampusesState {
  name: string
  formError: string
  prefixesText: string
  digitsText: string
  csvFileName: string
  csvError: string
  csvRowCount: number
  csvResolved: {
    payloads: CreateCampusPayload[]
    errors: string[]
    skippedDuplicates: string[]
  }
  search: string
  campuses: ApiCampus[]
  filtered: ApiCampus[]
  loading: boolean
  loadError: string | null
  createPending: boolean
  bulkPending: boolean
  updatePending: boolean
  editing: ApiCampus | null
  editName: string
  editPrefixesText: string
  editDigitsText: string
  editError: string
  deleteOpen: boolean
  deleteError: string
  deletePending: boolean
}

interface CampusesActions {
  changeName: (value: string) => void
  changePrefixes: (value: string) => void
  changeDigits: (value: string) => void
  handleAddOne: (event: FormEvent<HTMLFormElement>) => Promise<void>
  chooseCsv: (file: File | null, text: string) => void
  handleCsvImport: () => Promise<void>
  setSearch: (value: string) => void
  openEdit: (campus: ApiCampus) => void
  closeEdit: () => void
  changeEditName: (value: string) => void
  changeEditPrefixes: (value: string) => void
  changeEditDigits: (value: string) => void
  handleEditSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setDeleteOpen: (open: boolean) => void
  openDelete: () => void
  handleDelete: () => Promise<void>
}

interface CampusesContextValue {
  state: CampusesState
  actions: CampusesActions
}

const CampusesContext = createContext<CampusesContextValue | null>(null)

export function useCampusesPage() {
  const value = use(CampusesContext)
  if (!value) {
    throw new Error("useCampusesPage must be used within CampusesProvider")
  }
  return value
}

export function CampusesProvider({ children }: { children: ReactNode }) {
  const campusesQuery = useAdminCampusesQuery()
  const createCampus = useCreateCampusMutation()
  const updateCampus = useUpdateCampusMutation()
  const deleteCampus = useDeleteCampusMutation()
  const bulkCreate = useBulkCreateCampusesMutation()

  const [name, setName] = useState("")
  const [formError, setFormError] = useState("")
  const [prefixesText, setPrefixesText] = useState("")
  const [digitsText, setDigitsText] = useState("")
  const [csvNames, setCsvNames] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState("")
  const [csvError, setCsvError] = useState("")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ApiCampus | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrefixesText, setEditPrefixesText] = useState("")
  const [editDigitsText, setEditDigitsText] = useState("")
  const [editError, setEditError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const campuses = campusesQuery.data ?? EMPTY_CAMPUSES

  const existingNames = useMemo(
    () => new Set(campuses.map((campus) => campus.name.trim().toLowerCase())),
    [campuses]
  )

  const csvResolved = useMemo(() => {
    const payloads: CreateCampusPayload[] = []
    const errors: string[] = []
    const skippedDuplicates: string[] = []
    const seen = new Set<string>()

    for (const raw of csvNames) {
      const trimmed = raw.trim()
      const key = trimmed.toLowerCase()
      if (!trimmed) {
        continue
      }
      if (existingNames.has(key) || seen.has(key)) {
        skippedDuplicates.push(trimmed)
        continue
      }
      seen.add(key)
      payloads.push({ name: trimmed })
    }

    return { payloads, errors, skippedDuplicates }
  }, [csvNames, existingNames])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return campuses
    }
    return campuses.filter((campus) =>
      `${campus.name} ${campus.campus_id}`.toLowerCase().includes(query)
    )
  }, [campuses, search])

  function openEdit(campus: ApiCampus) {
    setEditing(campus)
    setEditName(campus.name)
    setEditPrefixesText((campus.classroom_name_prefixes ?? []).join(", "))
    setEditDigitsText(campus.classroom_name_digits != null ? String(campus.classroom_name_digits) : "")
    setEditError("")
  }

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setFormError("Campus name is required.")
      return
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setFormError("That campus is already registered.")
      return
    }

    const format = resolveClassroomFormat(prefixesText, digitsText)
    if (format.error) {
      setFormError(format.error)
      return
    }

    try {
      await createCampus.mutateAsync({ name: trimmed, ...format.payload })
      setName("")
      setPrefixesText("")
      setDigitsText("")
      setFormError("")
      toastManager.add({
        title: "Campus added",
        description: `${trimmed} is now registered.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not add campus",
        description: error instanceof Error ? error.message : "Request failed.",
        type: "error",
      })
    }
  }

  async function handleCsvImport() {
    const errors = csvResolved.errors
    if (csvResolved.payloads.length === 0) {
      setCsvError(
        errors[0] ??
          (csvNames.length === 0
            ? "Choose a CSV with a single name column."
            : csvResolved.skippedDuplicates.length > 0
              ? "Every campus in this file is already registered."
              : "No valid campus rows to import.")
      )
      return
    }

    const result = await bulkCreate.mutateAsync(csvResolved.payloads)
    const failed = result.failed.length + errors.length
    toastBulkResult(result.created.length, failed, "Campus")
    if (result.created.length > 0) {
      setCsvNames([])
      setCsvFileName("")
      setCsvError(errors.length > 0 ? errors.join(" ") : "")
    } else if (errors.length > 0) {
      setCsvError(errors.join(" "))
    }
  }

  async function handleEditSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) {
      return
    }

    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError("Campus name is required.")
      return
    }
    const duplicate = campuses.some(
      (campus) =>
        campus.campus_id !== editing.campus_id &&
        campus.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setEditError("That campus is already registered.")
      return
    }

    const format = resolveClassroomFormat(editPrefixesText, editDigitsText)
    if (format.error) {
      setEditError(format.error)
      return
    }

    try {
      await updateCampus.mutateAsync({
        campusId: editing.campus_id,
        name: trimmed,
        ...format.payload,
      })
      setEditing(null)
      toastManager.add({
        title: "Campus updated",
        description: `${trimmed} was saved.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not update campus",
        description: error instanceof Error ? error.message : "Request failed.",
        type: "error",
      })
    }
  }

  async function handleDelete() {
    if (!editing) {
      return
    }

    const removedName = editing.name
    try {
      await deleteCampus.mutateAsync(editing.campus_id)
      setDeleteOpen(false)
      setEditing(null)
      setEditError("")
      setDeleteError("")
      toastManager.add({
        title: "Campus removed",
        description: `${removedName} was deleted.`,
        type: "success",
      })
    } catch (error) {
      setDeleteOpen(false)
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete this campus."
      )
    }
  }

  const value: CampusesContextValue = {
    state: {
      name,
      formError,
      prefixesText,
      digitsText,
      csvFileName,
      csvError,
      csvRowCount: csvNames.length,
      csvResolved,
      search,
      campuses,
      filtered,
      loading: campusesQuery.isLoading,
      loadError: campusesQuery.isError
        ? campusesQuery.error instanceof Error
          ? campusesQuery.error.message
          : "The campus list failed to load."
        : null,
      createPending: createCampus.isPending,
      bulkPending: bulkCreate.isPending,
      updatePending: updateCampus.isPending,
      editing,
      editName,
      editPrefixesText,
      editDigitsText,
      editError,
      deleteOpen,
      deleteError,
      deletePending: deleteCampus.isPending,
    },
    actions: {
      changeName: (next) => {
        setName(next)
        if (formError) setFormError("")
      },
      changePrefixes: (next) => {
        setPrefixesText(next)
        if (formError) setFormError("")
      },
      changeDigits: (next) => {
        setDigitsText(next)
        if (formError) setFormError("")
      },
      handleAddOne,
      chooseCsv: (file, text) => {
        if (!file) {
          setCsvNames([])
          setCsvFileName("")
          setCsvError("")
          return
        }
        const names = parseSingleColumnCsv(text, ["name", "campus", "campuses"])
        setCsvFileName(file.name)
        setCsvNames(names)
        setCsvError("")
      },
      handleCsvImport,
      setSearch,
      openEdit,
      closeEdit: () => {
        setEditing(null)
        setEditError("")
        setDeleteOpen(false)
        setDeleteError("")
      },
      changeEditName: (next) => {
        setEditName(next)
        if (editError) setEditError("")
      },
      changeEditPrefixes: (next) => {
        setEditPrefixesText(next)
        if (editError) setEditError("")
      },
      changeEditDigits: (next) => {
        setEditDigitsText(next)
        if (editError) setEditError("")
      },
      handleEditSave,
      setDeleteOpen: (open) => {
        setDeleteOpen(open)
        if (!open) setDeleteError("")
      },
      openDelete: () => {
        setDeleteError("")
        setDeleteOpen(true)
      },
      handleDelete,
    },
  }

  return <CampusesContext value={value}>{children}</CampusesContext>
}
