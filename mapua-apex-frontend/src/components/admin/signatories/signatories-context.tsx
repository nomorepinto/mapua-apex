/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { use } from "react"

import {
  compareSignatoriesByRole,
  signatoryRoleLabel,
  takenSingletonRoles,
  type SignatoryRoleValue,
} from "@/components/admin-osa/signatory-roles"
import {
  DEPT_ITEMS,
  ROLE_ITEMS,
  departmentOption,
  type DepartmentOption,
  type RoleOption,
} from "@/components/admin/signatories/signatory-options"
import {
  accountSearchText,
  EMPTY_ACCOUNTS,
} from "@/components/admin/accounts/account-assignment"
import { signatoryNameError } from "@/components/admin/signatories/signatory-name"
import { toastManager } from "@/components/ui/toast"
import {
  useBulkCreateSignatoriesMutation,
  useCreateSignatoryMutation,
  useDeleteSignatoryMutation,
  useCognitoAccountsQuery,
  useSignatoriesQuery,
  useUpdateSignatoryMutation,
} from "@/hooks/use-admin"
import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import { departmentLabel } from "@/lib/departments"
import {
  buildSignatoryPayload,
  formatDocumentId,
  type ApiSignatory,
} from "@/lib/dynamodb-adapters"
import { parseSignatoryCsv, type SignatoryCsvRow } from "@/lib/parse-csv"
import type { ApiCampus } from "@/lib/types"

const ALL_CAMPUSES = "all"
const EMPTY_CAMPUSES: ApiCampus[] = []

export type OsaarCampusOption = { label: string; value: string }

const EMPTY_SIGNATORIES: ApiSignatory[] = []

function campusOptions(
  campuses: ApiCampus[],
  includeAll: boolean
): OsaarCampusOption[] {
  const options = campuses.map((campus) => ({
    label: campus.name,
    value: campus.campus_id,
  }))
  if (includeAll) {
    options.push({ label: "All campuses", value: ALL_CAMPUSES })
  }
  return options
}

function assignmentFrom(campusId: string | null): {
  campusId?: string
  allCampuses?: boolean
} | null {
  if (campusId === ALL_CAMPUSES) return { allCampuses: true }
  if (campusId) return { campusId }
  return null
}

export function osaarCampusLabel(
  person: ApiSignatory,
  campuses: ApiCampus[]
): string {
  if (person.role !== "osaar") return ""
  if (person.all_campuses) return "All campuses"
  return (
    campuses.find((campus) => campus.campus_id === person.campus_id)?.name ?? ""
  )
}

interface SignatoriesState {
  name: string
  role: SignatoryRoleValue | null
  department: DepartmentOption | null
  campusId: string | null
  campuses: ApiCampus[]
  campusItems: OsaarCampusOption[]
  selectedCampus: OsaarCampusOption | null
  editCampusItems: OsaarCampusOption[]
  selectedEditCampus: OsaarCampusOption | null
  formError: string
  csvError: string
  csvFileName: string
  csvRecordCount: number
  csvPayloads: {
    payloads: ReturnType<typeof buildSignatoryPayload>[]
    errors: string[]
  }
  search: string
  signatories: ApiSignatory[]
  filtered: ApiSignatory[]
  loading: boolean
  loadError: string | null
  roleItems: RoleOption[]
  selectedRole: RoleOption | null
  editRoleItems: RoleOption[]
  selectedEditRole: RoleOption | null
  departmentItems: DepartmentOption[]
  editDepartmentItems: DepartmentOption[]
  takenRoles: ReturnType<typeof takenSingletonRoles>
  canAddSignatory: boolean
  createPending: boolean
  bulkPending: boolean
  updatePending: boolean
  editing: ApiSignatory | null
  editName: string
  editRole: SignatoryRoleValue | null
  editDepartment: DepartmentOption | null
  editCampusId: string | null
  editError: string
  deleteOpen: boolean
  deleteError: string
  deletePending: boolean
}

interface SignatoriesActions {
  changeName: (value: string) => void
  changeRole: (role: SignatoryRoleValue | null) => void
  setDepartment: (value: DepartmentOption | null) => void
  setCampus: (campusId: string | null) => void
  handleAddOne: (event: FormEvent<HTMLFormElement>) => Promise<void>
  chooseCsv: (file: File | null, text: string) => void
  handleCsvImport: () => Promise<void>
  setSearch: (value: string) => void
  openEdit: (person: ApiSignatory) => void
  closeEdit: () => void
  changeEditName: (value: string) => void
  changeEditRole: (role: SignatoryRoleValue | null) => void
  setEditDepartment: (value: DepartmentOption | null) => void
  setEditCampus: (campusId: string | null) => void
  handleEditSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setDeleteOpen: (open: boolean) => void
  openDelete: () => void
  handleDelete: () => Promise<void>
}

interface SignatoriesContextValue {
  state: SignatoriesState
  actions: SignatoriesActions
}

const SignatoriesContext = createContext<SignatoriesContextValue | null>(null)

export function useSignatoriesPage() {
  const value = use(SignatoriesContext)
  if (!value) {
    throw new Error(
      "useSignatoriesPage must be used within SignatoriesProvider"
    )
  }
  return value
}

export function SignatoriesProvider({ children }: { children: ReactNode }) {
  const signatoriesQuery = useSignatoriesQuery()
  const campusesQuery = useAdminCampusesQuery()
  const accountsQuery = useCognitoAccountsQuery()
  const createSignatory = useCreateSignatoryMutation()
  const updateSignatory = useUpdateSignatoryMutation()
  const deleteSignatory = useDeleteSignatoryMutation()
  const bulkCreate = useBulkCreateSignatoriesMutation()

  const [name, setName] = useState("")
  const [role, setRole] = useState<SignatoryRoleValue | null>(null)
  const [department, setDepartment] = useState<DepartmentOption | null>(null)
  const [campusId, setCampusId] = useState<string | null>(null)
  const [formError, setFormError] = useState("")
  const [csvError, setCsvError] = useState("")
  const [csvFileName, setCsvFileName] = useState("")
  const [csvRecords, setCsvRecords] = useState<SignatoryCsvRow[]>([])
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ApiSignatory | null>(null)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<SignatoryRoleValue | null>(null)
  const [editDepartment, setEditDepartment] = useState<DepartmentOption | null>(
    null
  )
  const [editCampusId, setEditCampusId] = useState<string | null>(null)
  const [editError, setEditError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const signatories = signatoriesQuery.data ?? EMPTY_SIGNATORIES
  const campuses = campusesQuery.data ?? EMPTY_CAMPUSES
  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS
  const takenRoles = takenSingletonRoles(signatories)
  const allCampusTaken = signatories.some((person) => person.all_campuses)
  const editAllCampusTaken = signatories.some(
    (person) =>
      person.all_campuses && person.signatory_id !== editing?.signatory_id
  )
  const campusItems = useMemo(
    () => campusOptions(campuses, !allCampusTaken),
    [allCampusTaken, campuses]
  )
  const editCampusItems = useMemo(
    () => campusOptions(campuses, !editAllCampusTaken),
    [campuses, editAllCampusTaken]
  )
  const selectedCampus =
    campusItems.find((item) => item.value === campusId) ?? null
  const selectedEditCampus =
    editCampusItems.find((item) => item.value === editCampusId) ?? null

  const roleItems = useMemo(
    () => ROLE_ITEMS.filter((item) => !takenRoles.has(item.value)),
    [takenRoles]
  )
  const selectedRole = roleItems.find((item) => item.value === role) ?? null

  const editRoleItems = useMemo(() => {
    const taken = takenSingletonRoles(signatories, editing?.signatory_id)
    return ROLE_ITEMS.filter((item) => !taken.has(item.value))
  }, [editing?.signatory_id, signatories])
  const selectedEditRole =
    editRoleItems.find((item) => item.value === editRole) ?? null

  const departmentItems = useMemo(() => {
    if (
      department &&
      !DEPT_ITEMS.some((item) => item.value === department.value)
    ) {
      return [department, ...DEPT_ITEMS]
    }
    return DEPT_ITEMS
  }, [department])

  const editDepartmentItems = useMemo(() => {
    if (
      editDepartment &&
      !DEPT_ITEMS.some((item) => item.value === editDepartment.value)
    ) {
      return [editDepartment, ...DEPT_ITEMS]
    }
    return DEPT_ITEMS
  }, [editDepartment])

  const sortedSignatories = useMemo(
    () => [...signatories].sort(compareSignatoriesByRole),
    [signatories]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return sortedSignatories
    }
    return sortedSignatories.filter((person) => {
      const haystack = [
        person.name,
        person.signatory_id,
        formatDocumentId(person.signatory_id, "SIG"),
        person.role,
        signatoryRoleLabel(person.role),
        person.department ?? "",
        person.department ? departmentLabel(person.department) : "",
        osaarCampusLabel(person, campuses),
        accountSearchText(accounts, "signatory", person.signatory_id),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [accounts, campuses, search, sortedSignatories])

  const csvPayloads = useMemo(() => {
    const payloads = []
    const errors: string[] = [...csvParseErrors]
    const singletonCounts: Record<string, number> = {
      cdm: takenRoles.has("cdm") ? 1 : 0,
    }
    let allCampusTaken = signatories.some((person) => person.all_campuses)

    for (const record of csvRecords) {
      if (record.role in singletonCounts) {
        singletonCounts[record.role] += 1
        if (singletonCounts[record.role] > 1) {
          errors.push(
            `${record.name}: ${signatoryRoleLabel(record.role)} is already registered. Only one is allowed.`
          )
          continue
        }
      }
      if (record.role === "osaar") {
        const campusName = record.campus?.trim() ?? ""
        if (campusName.toLowerCase() === "all") {
          if (allCampusTaken) {
            errors.push(
              `${record.name}: an all-campus OSAAR signatory already exists.`
            )
            continue
          }
          allCampusTaken = true
          payloads.push(
            buildSignatoryPayload(record.name, record.role, record.department, {
              allCampuses: true,
            })
          )
          continue
        }
        const campus = campuses.find(
          (item) => item.name.trim().toLowerCase() === campusName.toLowerCase()
        )
        if (!campus) {
          errors.push(`${record.name}: campus "${campusName}" does not exist.`)
          continue
        }
        payloads.push(
          buildSignatoryPayload(record.name, record.role, record.department, {
            campusId: campus.campus_id,
          })
        )
        continue
      }
      payloads.push(
        buildSignatoryPayload(record.name, record.role, record.department)
      )
    }

    return { payloads, errors }
  }, [campuses, csvParseErrors, csvRecords, signatories, takenRoles])

  function openEdit(person: ApiSignatory) {
    setEditing(person)
    setEditName(person.name)
    setEditRole(person.role)
    setEditDepartment(departmentOption(person.department))
    setEditCampusId(
      person.role === "osaar"
        ? person.all_campuses
          ? ALL_CAMPUSES
          : (person.campus_id ?? null)
        : null
    )
    setEditError("")
  }

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !role) {
      setFormError("Name and role are required.")
      return
    }
    const nameError = signatoryNameError(name)
    if (nameError) {
      setFormError(nameError)
      return
    }
    if (takenRoles.has(role)) {
      setFormError(
        `${signatoryRoleLabel(role)} is already registered. Only one is allowed.`
      )
      return
    }
    if (role === "osaar" && !campusId) {
      setFormError("Choose the campus this OSAAR account is assigned to.")
      return
    }

    try {
      await createSignatory.mutateAsync(
        buildSignatoryPayload(
          name.trim(),
          role,
          department?.value,
          assignmentFrom(campusId)
        )
      )
      const addedName = name.trim()
      const addedRole = role
      setName("")
      setRole(null)
      setDepartment(null)
      setCampusId(null)
      setFormError("")
      toastManager.add({
        title: "Signatory added",
        description: `${addedName} is now registered as ${signatoryRoleLabel(addedRole)}.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not add signatory",
        description: error instanceof Error ? error.message : "Request failed.",
        type: "error",
      })
    }
  }

  async function handleCsvImport() {
    const { payloads, errors } = csvPayloads
    if (errors.length > 0 && payloads.length === 0) {
      setCsvError(errors[0])
      return
    }
    if (payloads.length === 0) {
      setCsvError("No valid signatory rows to import.")
      return
    }

    const result = await bulkCreate.mutateAsync(payloads)
    const failed = result.failed.length + errors.length
    if (result.created.length > 0 && failed === 0) {
      toastManager.add({
        title: "Signatories added",
        description: `Created ${result.created.length}.`,
        type: "success",
      })
    } else if (result.created.length > 0) {
      toastManager.add({
        title: "Partially added signatories",
        description: `Created ${result.created.length}. ${failed} skipped or failed.`,
        type: "warning",
      })
    } else {
      toastManager.add({
        title: "Could not add signatories",
        description: errors[0] ?? "Every row failed.",
        type: "error",
      })
    }

    if (result.created.length > 0) {
      setCsvRecords([])
      setCsvParseErrors([])
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
    if (!editName.trim() || !editRole) {
      setEditError("Name and role are required.")
      return
    }
    const nameError = signatoryNameError(editName)
    if (nameError) {
      setEditError(nameError)
      return
    }

    const taken = takenSingletonRoles(signatories, editing.signatory_id)
    if (taken.has(editRole)) {
      setEditError(
        `${signatoryRoleLabel(editRole)} is already registered. Only one is allowed.`
      )
      return
    }
    if (editRole === "osaar" && !editCampusId) {
      setEditError("Choose the campus this OSAAR account is assigned to.")
      return
    }

    try {
      await updateSignatory.mutateAsync({
        signatoryId: editing.signatory_id,
        ...buildSignatoryPayload(
          editName.trim(),
          editRole,
          editDepartment?.value,
          assignmentFrom(editCampusId)
        ),
      })
      setEditing(null)
      toastManager.add({
        title: "Signatory updated",
        description: `${editName.trim()} was saved.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not update signatory",
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
      await deleteSignatory.mutateAsync(editing.signatory_id)
      setDeleteOpen(false)
      setEditing(null)
      setEditError("")
      setDeleteError("")
      toastManager.add({
        title: "Signatory removed",
        description: `${removedName} was deleted.`,
        type: "success",
      })
    } catch (error) {
      setDeleteOpen(false)
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete this signatory."
      )
    }
  }

  const value: SignatoriesContextValue = {
    state: {
      name,
      role,
      department,
      campusId,
      campuses,
      campusItems,
      selectedCampus,
      editCampusItems,
      selectedEditCampus,
      formError,
      csvError,
      csvFileName,
      csvRecordCount: csvRecords.length,
      csvPayloads,
      search,
      signatories,
      filtered,
      loading: signatoriesQuery.isLoading,
      loadError: signatoriesQuery.isError
        ? signatoriesQuery.error instanceof Error
          ? signatoriesQuery.error.message
          : "The admin signatories list failed to load."
        : null,
      roleItems,
      selectedRole,
      editRoleItems,
      selectedEditRole,
      departmentItems,
      editDepartmentItems,
      takenRoles,
      canAddSignatory:
        name.trim().length >= 3 &&
        name.trim().length <= 30 &&
        !/^[.]|[^\p{L}\s.]|\d/u.test(name.trim()) &&
        role !== null &&
        !takenRoles.has(role) &&
        (role !== "osaar" || campusId !== null),
      createPending: createSignatory.isPending,
      bulkPending: bulkCreate.isPending,
      updatePending: updateSignatory.isPending,
      editing,
      editName,
      editRole,
      editDepartment,
      editCampusId,
      editError,
      deleteOpen,
      deleteError,
      deletePending: deleteSignatory.isPending,
    },
    actions: {
      changeName: (next) => {
        setName(next)
        if (formError) setFormError("")
      },
      changeRole: (nextRole) => {
        setRole(nextRole)
        if (nextRole !== "dean") setDepartment(null)
        if (nextRole !== "osaar") setCampusId(null)
        if (formError) setFormError("")
      },
      setDepartment,
      setCampus: (next) => {
        setCampusId(next)
        if (formError) setFormError("")
      },
      handleAddOne,
      chooseCsv: (file, text) => {
        if (!file) {
          setCsvRecords([])
          setCsvParseErrors([])
          setCsvFileName("")
          setCsvError("")
          return
        }
        const parsed = parseSignatoryCsv(text)
        setCsvFileName(file.name)
        setCsvRecords(parsed.records)
        setCsvParseErrors(parsed.errors)
        setCsvError(parsed.errors[0] ?? "")
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
      changeEditRole: (nextRole) => {
        setEditRole(nextRole)
        if (nextRole !== "dean") setEditDepartment(null)
        if (nextRole !== "osaar") setEditCampusId(null)
        if (editError) setEditError("")
      },
      setEditDepartment,
      setEditCampus: (next) => {
        setEditCampusId(next)
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

  return <SignatoriesContext value={value}>{children}</SignatoriesContext>
}
