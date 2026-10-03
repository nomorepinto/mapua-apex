/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { use } from "react"

import {
  ORGANIZATION_ASSIGNABLE_DESK_ITEMS,
  deskAssignment,
  findByRole,
  missingSharedRoles,
  optionFromPerson,
  optionsForRole,
  resolveSignatoryByRole,
  type SignatoryOption,
} from "@/components/admin-osa/signatory-roles"
import {
  emptyDesks,
  toastBulkResult,
  withSharedDesks,
  type AssignableDesks,
} from "@/components/admin/organizations/organization-desks"
import { toastManager } from "@/components/ui/toast"
import {
  useBulkCreateOrganizationsMutation,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useSignatoriesQuery,
  useUpdateOrganizationMutation,
} from "@/hooks/use-admin"
import type {
  ApiOrganization,
  ApiSignatory,
  CreateOrganizationPayload,
  OrganizationAssignableDeskRole,
} from "@/lib/dynamodb-adapters"
import {
  parseOrganizationCsv,
  type OrganizationCsvRow,
} from "@/lib/parse-csv"

const EMPTY_ORGANIZATIONS: ApiOrganization[] = []
const EMPTY_SIGNATORIES: ApiSignatory[] = []

interface OrganizationsState {
  name: string
  desks: AssignableDesks
  isHigherCouncil: boolean
  formError: string
  csvFileName: string
  csvError: string
  csvRowCount: number
  csvResolved: {
    payloads: CreateOrganizationPayload[]
    errors: string[]
    skippedDuplicates: string[]
  }
  search: string
  organizations: ApiOrganization[]
  filtered: ApiOrganization[]
  directoryLoading: boolean
  loadError: string | null
  deskOptions: Record<OrganizationAssignableDeskRole, SignatoryOption[]>
  missingShared: ReturnType<typeof missingSharedRoles>
  sharedAccountsReady: boolean
  missingAssignable: typeof ORGANIZATION_ASSIGNABLE_DESK_ITEMS[number][]
  canAddOrganization: boolean
  sharedAdminName: string
  sharedCdmName: string
  sharedOsaarName: string
  peopleById: Map<string, ApiSignatory>
  createPending: boolean
  bulkPending: boolean
  updatePending: boolean
  signatoriesLoading: boolean
  editing: ApiOrganization | null
  editName: string
  editDesks: AssignableDesks
  editIsHigherCouncil: boolean
  editError: string
}

interface OrganizationsActions {
  changeName: (value: string) => void
  changeDesk: (
    role: OrganizationAssignableDeskRole,
    value: SignatoryOption | null
  ) => void
  setIsHigherCouncil: (checked: boolean) => void
  handleAddOne: (event: FormEvent<HTMLFormElement>) => Promise<void>
  chooseCsv: (file: File | null, text: string) => void
  handleCsvImport: () => Promise<void>
  setSearch: (value: string) => void
  openEdit: (org: ApiOrganization) => void
  closeEdit: () => void
  changeEditName: (value: string) => void
  changeEditDesk: (
    role: OrganizationAssignableDeskRole,
    value: SignatoryOption | null
  ) => void
  setEditIsHigherCouncil: (checked: boolean) => void
  handleEditSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

interface OrganizationsContextValue {
  state: OrganizationsState
  actions: OrganizationsActions
}

const OrganizationsContext = createContext<OrganizationsContextValue | null>(null)

export function useOrganizationsPage() {
  const value = use(OrganizationsContext)
  if (!value) {
    throw new Error("useOrganizationsPage must be used within OrganizationsProvider")
  }
  return value
}

export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const orgsQuery = useOrganizationsQuery()
  const signatoriesQuery = useSignatoriesQuery()
  const createOrg = useCreateOrganizationMutation()
  const updateOrg = useUpdateOrganizationMutation()
  const bulkCreate = useBulkCreateOrganizationsMutation()

  const [name, setName] = useState("")
  const [desks, setDesks] = useState<AssignableDesks>(emptyDesks)
  const [isHigherCouncil, setIsHigherCouncil] = useState(false)
  const [formError, setFormError] = useState("")
  const [csvRows, setCsvRows] = useState<OrganizationCsvRow[]>([])
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState("")
  const [csvError, setCsvError] = useState("")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ApiOrganization | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesks, setEditDesks] = useState<AssignableDesks>(emptyDesks)
  const [editIsHigherCouncil, setEditIsHigherCouncil] = useState(false)
  const [editError, setEditError] = useState("")

  const organizations = orgsQuery.data ?? EMPTY_ORGANIZATIONS
  const signatories = signatoriesQuery.data ?? EMPTY_SIGNATORIES
  const peopleById = useMemo(
    () =>
      new Map(
        signatories.map((person) => [person.signatory_id, person] as const)
      ),
    [signatories]
  )

  const existingNames = useMemo(
    () => new Set(organizations.map((org) => org.name.trim().toLowerCase())),
    [organizations]
  )

  const deskOptions = useMemo(
    () => ({
      dean: optionsForRole(signatories, "dean"),
      adviser: optionsForRole(signatories, "adviser"),
    }),
    [signatories]
  )

  const missingShared = missingSharedRoles(signatories)
  const sharedAccountsReady = missingShared.length === 0
  const missingAssignable = ORGANIZATION_ASSIGNABLE_DESK_ITEMS.filter(
    (item) => deskOptions[item.value].length === 0
  )

  const sharedAdmin = findByRole(signatories, "admin")
  const sharedCdm = findByRole(signatories, "cdm")
  const sharedOsaar = findByRole(signatories, "osaar")

  const csvResolved = useMemo(() => {
    const payloads: CreateOrganizationPayload[] = []
    const errors: string[] = []
    const skippedDuplicates: string[] = []

    for (const row of csvRows) {
      if (existingNames.has(row.name.trim().toLowerCase())) {
        skippedDuplicates.push(row.name)
        continue
      }

      let rowFailed = false
      const selected: Partial<AssignableDesks> = {}

      for (const item of ORGANIZATION_ASSIGNABLE_DESK_ITEMS) {
        const { match, ambiguous } = resolveSignatoryByRole(
          signatories,
          item.value,
          row.desks[item.value]
        )
        if (ambiguous) {
          errors.push(
            `${row.name}: more than one ${item.label.toLowerCase()} matches “${row.desks[item.value]}”.`
          )
          rowFailed = true
          break
        }
        if (!match) {
          errors.push(
            `${row.name}: unknown ${item.label.toLowerCase()} “${row.desks[item.value]}”.`
          )
          rowFailed = true
          break
        }
        selected[item.value] = {
          label: match.name,
          value: match.signatory_id,
        }
      }

      if (rowFailed || !selected.dean || !selected.adviser) {
        continue
      }

      const assignments = withSharedDesks(
        selected.dean,
        selected.adviser,
        signatories
      )
      if (!assignments) {
        errors.push(
          `${row.name}: admin, CDM, and OSAAR accounts must exist before importing organizations.`
        )
        continue
      }

      payloads.push({
        name: row.name.trim(),
        signatories: assignments,
        is_higher_council: row.is_higher_council,
      })
    }

    return { payloads, errors, skippedDuplicates }
  }, [csvRows, existingNames, signatories])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return organizations
    }
    return organizations.filter((org) => {
      const haystack = [
        org.name,
        org.organization_id,
        org.is_higher_council ? "higher council" : "",
        ...ORGANIZATION_ASSIGNABLE_DESK_ITEMS.map((item) => {
          const id = deskAssignment(org, item.value)
          return id ? (peopleById.get(id)?.name ?? id) : ""
        }),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [organizations, peopleById, search])

  function openEdit(org: ApiOrganization) {
    setEditing(org)
    setEditName(org.name)
    setEditDesks({
      dean: optionFromPerson(peopleById.get(deskAssignment(org, "dean") ?? "")),
      adviser: optionFromPerson(
        peopleById.get(deskAssignment(org, "adviser") ?? "")
      ),
    })
    setEditIsHigherCouncil(Boolean(org.is_higher_council))
    setEditError("")
  }

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setFormError("Organization name is required.")
      return
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setFormError("That organization is already registered.")
      return
    }
    if (!sharedAccountsReady) {
      setFormError("Register shared admin, CDM, and OSAAR accounts first.")
      return
    }
    if (!desks.dean || !desks.adviser) {
      setFormError("Select a dean and an adviser.")
      return
    }

    const assignments = withSharedDesks(desks.dean, desks.adviser, signatories)
    if (!assignments) {
      setFormError("Register shared admin, CDM, and OSAAR accounts first.")
      return
    }

    try {
      await createOrg.mutateAsync({
        name: trimmed,
        signatories: assignments,
        is_higher_council: isHigherCouncil,
      })
      setName("")
      setDesks(emptyDesks())
      setIsHigherCouncil(false)
      setFormError("")
      toastManager.add({
        title: "Organization added",
        description: `${trimmed} is now registered.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not add organization",
        description: error instanceof Error ? error.message : "Request failed.",
        type: "error",
      })
    }
  }

  async function handleCsvImport() {
    if (!sharedAccountsReady) {
      setCsvError("Register shared admin, CDM, and OSAAR accounts first.")
      return
    }

    const errors = [...csvParseErrors, ...csvResolved.errors]
    if (csvResolved.payloads.length === 0) {
      setCsvError(
        errors[0] ??
          (csvRows.length === 0
            ? "Choose a CSV with name, dean, adviser, and is_higher_council columns."
            : csvResolved.skippedDuplicates.length > 0
              ? "Every organization in this file is already registered."
              : "No valid organization rows to import.")
      )
      return
    }

    const result = await bulkCreate.mutateAsync(csvResolved.payloads)
    const failed = result.failed.length + errors.length
    toastBulkResult(result.created.length, failed, "Organization")
    if (result.created.length > 0) {
      setCsvRows([])
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

    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError("Organization name is required.")
      return
    }
    const duplicate = organizations.some(
      (org) =>
        org.organization_id !== editing.organization_id &&
        org.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setEditError("That organization is already registered.")
      return
    }
    if (!editDesks.dean || !editDesks.adviser) {
      setEditError("Select a dean and an adviser.")
      return
    }

    const assignments = withSharedDesks(
      editDesks.dean,
      editDesks.adviser,
      signatories
    )
    if (!assignments) {
      setEditError("Register shared admin, CDM, and OSAAR accounts first.")
      return
    }

    try {
      await updateOrg.mutateAsync({
        organizationId: editing.organization_id,
        name: trimmed,
        signatories: assignments,
        is_higher_council: editIsHigherCouncil,
      })
      setEditing(null)
      toastManager.add({
        title: "Organization updated",
        description: `${trimmed} was saved.`,
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not update organization",
        description: error instanceof Error ? error.message : "Request failed.",
        type: "error",
      })
    }
  }

  const loadError =
    orgsQuery.isError || signatoriesQuery.isError
      ? (orgsQuery.error instanceof Error && orgsQuery.error.message) ||
        (signatoriesQuery.error instanceof Error &&
          signatoriesQuery.error.message) ||
        "Organizations or signatories failed to load."
      : null

  const value: OrganizationsContextValue = {
    state: {
      name,
      desks,
      isHigherCouncil,
      formError,
      csvFileName,
      csvError,
      csvRowCount: csvRows.length,
      csvResolved,
      search,
      organizations,
      filtered,
      directoryLoading: orgsQuery.isLoading || signatoriesQuery.isLoading,
      loadError,
      deskOptions,
      missingShared,
      sharedAccountsReady,
      missingAssignable,
      canAddOrganization: sharedAccountsReady && missingAssignable.length === 0,
      sharedAdminName: sharedAdmin?.name ?? "—",
      sharedCdmName: sharedCdm?.name ?? "—",
      sharedOsaarName: sharedOsaar?.name ?? "—",
      peopleById,
      createPending: createOrg.isPending,
      bulkPending: bulkCreate.isPending,
      updatePending: updateOrg.isPending,
      signatoriesLoading: signatoriesQuery.isLoading,
      editing,
      editName,
      editDesks,
      editIsHigherCouncil,
      editError,
    },
    actions: {
      changeName: (next) => {
        setName(next)
        if (formError) setFormError("")
      },
      changeDesk: (role, next) => {
        setDesks((current) => ({ ...current, [role]: next }))
        if (formError) setFormError("")
      },
      setIsHigherCouncil,
      handleAddOne,
      chooseCsv: (file, text) => {
        if (!file) {
          setCsvRows([])
          setCsvParseErrors([])
          setCsvFileName("")
          setCsvError("")
          return
        }
        const parsed = parseOrganizationCsv(text)
        setCsvFileName(file.name)
        setCsvRows(parsed.rows)
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
      changeEditDesk: (role, next) => {
        setEditDesks((current) => ({ ...current, [role]: next }))
        if (editError) setEditError("")
      },
      setEditIsHigherCouncil,
      handleEditSave,
    },
  }

  return <OrganizationsContext value={value}>{children}</OrganizationsContext>
}
