/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, type FormEvent, type ReactNode } from "react"
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
import { toastManager } from "@/components/ui/toast"
import {
  useBulkCreateSignatoriesMutation,
  useCreateSignatoryMutation,
  useSignatoriesQuery,
  useUpdateSignatoryMutation,
} from "@/hooks/use-admin"
import { departmentLabel } from "@/lib/departments"
import { buildSignatoryPayload, type ApiSignatory } from "@/lib/dynamodb-adapters"
import { parseSignatoryCsv, type SignatoryCsvRow } from "@/lib/parse-csv"

const EMPTY_SIGNATORIES: ApiSignatory[] = []

interface SignatoriesState {
  name: string
  role: SignatoryRoleValue | null
  department: DepartmentOption | null
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
  createPending: boolean
  bulkPending: boolean
  updatePending: boolean
  editing: ApiSignatory | null
  editName: string
  editRole: SignatoryRoleValue | null
  editDepartment: DepartmentOption | null
  editError: string
}

interface SignatoriesActions {
  changeName: (value: string) => void
  changeRole: (role: SignatoryRoleValue | null) => void
  setDepartment: (value: DepartmentOption | null) => void
  handleAddOne: (event: FormEvent<HTMLFormElement>) => Promise<void>
  chooseCsv: (file: File | null, text: string) => void
  handleCsvImport: () => Promise<void>
  setSearch: (value: string) => void
  openEdit: (person: ApiSignatory) => void
  closeEdit: () => void
  changeEditName: (value: string) => void
  changeEditRole: (role: SignatoryRoleValue | null) => void
  setEditDepartment: (value: DepartmentOption | null) => void
  handleEditSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

interface SignatoriesContextValue {
  state: SignatoriesState
  actions: SignatoriesActions
}

const SignatoriesContext = createContext<SignatoriesContextValue | null>(null)

export function useSignatoriesPage() {
  const value = use(SignatoriesContext)
  if (!value) {
    throw new Error("useSignatoriesPage must be used within SignatoriesProvider")
  }
  return value
}

export function SignatoriesProvider({ children }: { children: ReactNode }) {
  const signatoriesQuery = useSignatoriesQuery()
  const createSignatory = useCreateSignatoryMutation()
  const updateSignatory = useUpdateSignatoryMutation()
  const bulkCreate = useBulkCreateSignatoriesMutation()

  const [name, setName] = useState("")
  const [role, setRole] = useState<SignatoryRoleValue | null>(null)
  const [department, setDepartment] = useState<DepartmentOption | null>(null)
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
  const [editError, setEditError] = useState("")

  const signatories = signatoriesQuery.data ?? EMPTY_SIGNATORIES
  const takenRoles = takenSingletonRoles(signatories)

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
        person.role,
        signatoryRoleLabel(person.role),
        person.department ?? "",
        person.department ? departmentLabel(person.department) : "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search, sortedSignatories])

  const csvPayloads = useMemo(() => {
    const payloads = []
    const errors: string[] = [...csvParseErrors]
    const singletonCounts: Record<string, number> = {
      admin: takenRoles.has("admin") ? 1 : 0,
      cdm: takenRoles.has("cdm") ? 1 : 0,
      osaar: takenRoles.has("osaar") ? 1 : 0,
    }

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
      payloads.push(
        buildSignatoryPayload(record.name, record.role, record.department)
      )
    }

    return { payloads, errors }
  }, [csvParseErrors, csvRecords, takenRoles])

  function openEdit(person: ApiSignatory) {
    setEditing(person)
    setEditName(person.name)
    setEditRole(person.role)
    setEditDepartment(departmentOption(person.department))
    setEditError("")
  }

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !role) {
      setFormError("Name and role are required.")
      return
    }
    if (takenRoles.has(role)) {
      setFormError(
        `${signatoryRoleLabel(role)} is already registered. Only one is allowed.`
      )
      return
    }

    try {
      await createSignatory.mutateAsync(
        buildSignatoryPayload(name.trim(), role, department?.value)
      )
      const addedName = name.trim()
      const addedRole = role
      setName("")
      setRole(null)
      setDepartment(null)
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

    const taken = takenSingletonRoles(signatories, editing.signatory_id)
    if (taken.has(editRole)) {
      setEditError(
        `${signatoryRoleLabel(editRole)} is already registered. Only one is allowed.`
      )
      return
    }

    try {
      await updateSignatory.mutateAsync({
        signatoryId: editing.signatory_id,
        ...buildSignatoryPayload(editName.trim(), editRole, editDepartment?.value),
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

  const value: SignatoriesContextValue = {
    state: {
      name,
      role,
      department,
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
      createPending: createSignatory.isPending,
      bulkPending: bulkCreate.isPending,
      updatePending: updateSignatory.isPending,
      editing,
      editName,
      editRole,
      editDepartment,
      editError,
    },
    actions: {
      changeName: (next) => {
        setName(next)
        if (formError) setFormError("")
      },
      changeRole: (nextRole) => {
        setRole(nextRole)
        if (nextRole !== "dean") setDepartment(null)
        if (formError) setFormError("")
      },
      setDepartment,
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
      },
      changeEditName: (next) => {
        setEditName(next)
        if (editError) setEditError("")
      },
      changeEditRole: (nextRole) => {
        setEditRole(nextRole)
        if (nextRole !== "dean") setEditDepartment(null)
        if (editError) setEditError("")
      },
      setEditDepartment,
      handleEditSave,
    },
  }

  return <SignatoriesContext value={value}>{children}</SignatoriesContext>
}
