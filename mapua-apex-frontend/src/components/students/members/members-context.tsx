/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { use } from "react"

import { toastManager } from "@/components/ui/toast"
import {
  useBulkCreateMembersMutation,
  useCreateMemberMutation,
  useDeleteMemberMutation,
  useMembersQuery,
  useUpdateMemberMutation,
  mutationErrorMessage,
} from "@/hooks/use-members"
import type { ApiMember } from "@/lib/dynamodb-adapters"
import { parseMemberCsv, type MemberCsvRow } from "@/lib/parse-csv"

const EMPTY_MEMBERS: ApiMember[] = []

interface MembersState {
  lastname: string
  firstname: string
  studentNumber: string
  formError: string
  csvFileName: string
  csvError: string
  csvRowCount: number
  csvRows: MemberCsvRow[]
  csvParseErrors: string[]
  search: string
  members: ApiMember[]
  filtered: ApiMember[]
  loading: boolean
  loadError: string | null
  createPending: boolean
  bulkPending: boolean
  updatePending: boolean
  deletePending: boolean
  editing: ApiMember | null
  editLastname: string
  editFirstname: string
  editError: string
  deleteOpen: boolean
  deleteError: string
}

interface MembersActions {
  changeLastname: (value: string) => void
  changeFirstname: (value: string) => void
  changeStudentNumber: (value: string) => void
  handleAddOne: (event: FormEvent<HTMLFormElement>) => Promise<void>
  chooseCsv: (file: File | null, text: string) => void
  handleCsvImport: () => Promise<void>
  setSearch: (value: string) => void
  openEdit: (member: ApiMember) => void
  closeEdit: () => void
  changeEditLastname: (value: string) => void
  changeEditFirstname: (value: string) => void
  handleEditSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setDeleteOpen: (open: boolean) => void
  openDelete: () => void
  handleDelete: () => Promise<void>
}

interface MembersContextValue {
  state: MembersState
  actions: MembersActions
}

const MembersContext = createContext<MembersContextValue | null>(null)

export function useMembersPage() {
  const value = use(MembersContext)
  if (!value) {
    throw new Error("useMembersPage must be used within MembersProvider")
  }
  return value
}

export function MembersProvider({ children }: { children: ReactNode }) {
  const membersQuery = useMembersQuery()
  const createMember = useCreateMemberMutation()
  const bulkCreate = useBulkCreateMembersMutation()
  const updateMember = useUpdateMemberMutation()
  const deleteMember = useDeleteMemberMutation()

  const [lastname, setLastname] = useState("")
  const [firstname, setFirstname] = useState("")
  const [studentNumber, setStudentNumber] = useState("")
  const [formError, setFormError] = useState("")
  const [csvRows, setCsvRows] = useState<MemberCsvRow[]>([])
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState("")
  const [csvError, setCsvError] = useState("")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ApiMember | null>(null)
  const [editLastname, setEditLastname] = useState("")
  const [editFirstname, setEditFirstname] = useState("")
  const [editError, setEditError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const members = membersQuery.data ?? EMPTY_MEMBERS

  const existingIds = useMemo(
    () => new Set(members.map((m) => m.student_number.trim().toLowerCase())),
    [members]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return members
    return members.filter((m) => {
      const haystack =
        `${m.student_number} ${m.lastname} ${m.firstname}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [members, search])

  const loadError = membersQuery.isError
    ? (membersQuery.error instanceof Error && membersQuery.error.message) ||
      "Members failed to load."
    : null

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedLast = lastname.trim()
    const trimmedFirst = firstname.trim()
    const trimmedId = studentNumber.trim()

    if (!trimmedId || !trimmedLast || !trimmedFirst) {
      setFormError("All fields are required.")
      return
    }
    if (existingIds.has(trimmedId.toLowerCase())) {
      setFormError("That student number is already a member.")
      return
    }

    try {
      await createMember.mutateAsync({
        student_number: trimmedId,
        lastname: trimmedLast,
        firstname: trimmedFirst,
      })
      setLastname("")
      setFirstname("")
      setStudentNumber("")
      setFormError("")
      toastManager.add({
        title: "Member added",
        description: `${trimmedFirst} ${trimmedLast} (${trimmedId})`,
        type: "success",
      })
    } catch (error) {
      setFormError(mutationErrorMessage(error, "Could not add member."))
    }
  }

  async function handleCsvImport() {
    const errors = [...csvParseErrors]
    // Filter out duplicates already in the roster
    const toImport = csvRows.filter(
      (row) => !existingIds.has(row.student_number.trim().toLowerCase())
    )
    const skippedDuplicates = csvRows.length - toImport.length

    if (toImport.length === 0) {
      setCsvError(
        errors[0] ??
          (csvRows.length === 0
            ? "Choose a CSV with lastname, firstname, student_number columns."
            : skippedDuplicates > 0
              ? "Every student in this file is already a member."
              : "No valid rows to import.")
      )
      return
    }

    try {
      const result = await bulkCreate.mutateAsync(
        toImport.map((row) => ({
          student_number: row.student_number,
          lastname: row.lastname,
          firstname: row.firstname,
        }))
      )
      const failedCount = result.failed.length + errors.length
      const createdCount = result.created.length

      toastManager.add({
        title: "CSV import complete",
        description:
          `${createdCount} member${createdCount === 1 ? "" : "s"} added.` +
          (failedCount > 0
            ? ` ${failedCount} failed.`
            : "") +
          (skippedDuplicates > 0
            ? ` ${skippedDuplicates} skipped (already exist).`
            : ""),
        type: failedCount > 0 ? "warning" : "success",
      })

      setCsvRows([])
      setCsvParseErrors([])
      setCsvFileName("")
      setCsvError(errors.length > 0 ? errors.join(" ") : "")
    } catch (error) {
      setCsvError(mutationErrorMessage(error, "Bulk import failed."))
    }
  }

  function openEdit(member: ApiMember) {
    setEditing(member)
    setEditLastname(member.lastname)
    setEditFirstname(member.firstname)
    setEditError("")
  }

  async function handleEditSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return

    const trimmedLast = editLastname.trim()
    const trimmedFirst = editFirstname.trim()

    if (!trimmedLast || !trimmedFirst) {
      setEditError("Both names are required.")
      return
    }

    try {
      await updateMember.mutateAsync({
        studentId: editing.student_number,
        lastname: trimmedLast,
        firstname: trimmedFirst,
      })
      setEditing(null)
      toastManager.add({
        title: "Member updated",
        description: `${trimmedFirst} ${trimmedLast} was saved.`,
        type: "success",
      })
    } catch (error) {
      setEditError(mutationErrorMessage(error, "Could not update member."))
    }
  }

  async function handleDelete() {
    if (!editing) return

    const removedName = `${editing.firstname} ${editing.lastname}`
    try {
      await deleteMember.mutateAsync(editing.student_number)
      setDeleteOpen(false)
      setEditing(null)
      setEditError("")
      setDeleteError("")
      toastManager.add({
        title: "Member removed",
        description: `${removedName} was deleted.`,
        type: "success",
      })
    } catch (error) {
      setDeleteOpen(false)
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete this member."
      )
    }
  }

  const value: MembersContextValue = {
    state: {
      lastname,
      firstname,
      studentNumber,
      formError,
      csvFileName,
      csvError,
      csvRowCount: csvRows.length,
      csvRows,
      csvParseErrors,
      search,
      members,
      filtered,
      loading: membersQuery.isLoading,
      loadError,
      createPending: createMember.isPending,
      bulkPending: bulkCreate.isPending,
      updatePending: updateMember.isPending,
      deletePending: deleteMember.isPending,
      editing,
      editLastname,
      editFirstname,
      editError,
      deleteOpen,
      deleteError,
    },
    actions: {
      changeLastname: (next) => {
        setLastname(next)
        if (formError) setFormError("")
      },
      changeFirstname: (next) => {
        setFirstname(next)
        if (formError) setFormError("")
      },
      changeStudentNumber: (next) => {
        setStudentNumber(next)
        if (formError) setFormError("")
      },
      handleAddOne,
      chooseCsv: (file, text) => {
        if (!file) {
          setCsvRows([])
          setCsvParseErrors([])
          setCsvFileName("")
          setCsvError("")
          return
        }
        const parsed = parseMemberCsv(text)
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
        setDeleteOpen(false)
        setDeleteError("")
      },
      changeEditLastname: (next) => {
        setEditLastname(next)
        if (editError) setEditError("")
      },
      changeEditFirstname: (next) => {
        setEditFirstname(next)
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

  return <MembersContext value={value}>{children}</MembersContext>
}
