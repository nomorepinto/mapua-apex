/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { toastManager } from "@/components/ui/toast"
import {
  mutationErrorMessage,
  useApprovalSettingsQuery,
  useUpdateApprovalSettingsMutation,
} from "@/hooks/use-admin"
import type { ApiApprovalSettings } from "@/lib/dynamodb-adapters"

export interface DraftCampusGroup {
  campusId: string
  campusName: string
  ids: string[]
  names: Record<string, string>
}

interface ApprovalStagesState {
  loading: boolean
  loadError: string | null
  groups: DraftCampusGroup[]
  allCampusName: string | null
  unassigned: { signatoryId: string; name: string }[]
  formError: string
  savePending: boolean
  dirty: boolean
  canSave: boolean
}

interface ApprovalStagesActions {
  move: (campusId: string, index: number, direction: -1 | 1) => void
  save: () => Promise<void>
}

const ApprovalStagesContext = createContext<{
  state: ApprovalStagesState
  actions: ApprovalStagesActions
} | null>(null)

function groupsFrom(settings: ApiApprovalSettings): DraftCampusGroup[] {
  return settings.campuses.map((campus) => ({
    campusId: campus.campus_id,
    campusName: campus.campus_name,
    ids: campus.osaar_stages.map((stage) => stage.signatory_id),
    names: Object.fromEntries(
      campus.osaar_stages.map((stage) => [stage.signatory_id, stage.signatory_name])
    ),
  }))
}

function sameGroups(left: DraftCampusGroup[], right: DraftCampusGroup[]): boolean {
  if (left.length !== right.length) return false
  return left.every((group, index) => {
    const other = right[index]
    if (!other || group.campusId !== other.campusId) return false
    return group.ids.every((id, idIndex) => id === other.ids[idIndex])
  })
}

export function ApprovalStagesProvider({ children }: { children: ReactNode }) {
  const settingsQuery = useApprovalSettingsQuery()
  const updateSettings = useUpdateApprovalSettingsMutation()
  const [draft, setDraft] = useState<DraftCampusGroup[]>([])
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null)
  const [formError, setFormError] = useState("")
  const touched = useRef(false)

  const settings = settingsQuery.data
  const signature = settings
    ? settings.campuses
        .map(
          (campus) =>
            `${campus.campus_id}:${campus.osaar_stages
              .map((stage) => stage.signatory_id)
              .join(",")}`
        )
        .join("|")
    : null
  const serverDraft = settings ? groupsFrom(settings) : []
  if (settings && signature !== hydratedFrom && !touched.current) {
    setHydratedFrom(signature)
    setDraft(serverDraft)
    setFormError("")
  }
  const resolvedDraft =
    settings && signature !== hydratedFrom && !touched.current ? serverDraft : draft

  const dirty = settings ? !sameGroups(resolvedDraft, serverDraft) : false
  const allCampusName = settings?.all_campus_signatory?.signatory_name ?? null
  const unassigned = useMemo(
    () =>
      (settings?.unassigned ?? []).map((person) => ({
        signatoryId: person.signatory_id,
        name: person.signatory_name,
      })),
    [settings]
  )

  const value = {
    state: {
      loading: settingsQuery.isLoading,
      loadError: settingsQuery.isError
        ? mutationErrorMessage(settingsQuery.error, "Approval stages failed to load.")
        : null,
      groups: resolvedDraft,
      allCampusName,
      unassigned,
      formError,
      savePending: updateSettings.isPending,
      dirty,
      canSave: dirty && resolvedDraft.some((group) => group.ids.length > 0),
    } satisfies ApprovalStagesState,
    actions: {
      move: (campusId: string, index: number, direction: -1 | 1) => {
        touched.current = true
        setDraft((current) => {
          const base = current.length > 0 ? current : resolvedDraft
          return base.map((group) => {
            if (group.campusId !== campusId) return group
            const next = index + direction
            if (next < 0 || next >= group.ids.length) return group
            const ids = [...group.ids]
            const [moved] = ids.splice(index, 1)
            if (!moved) return group
            ids.splice(next, 0, moved)
            return { ...group, ids }
          })
        })
        setFormError("")
      },
      save: async () => {
        const changed = resolvedDraft.filter((group, index) => {
          const server = serverDraft[index]
          if (!server || group.ids.length === 0) return false
          return group.ids.some((id, idIndex) => id !== server.ids[idIndex])
        })
        if (changed.length === 0) return
        try {
          for (const group of changed) {
            await updateSettings.mutateAsync({
              campusId: group.campusId,
              signatoryIds: group.ids,
            })
          }
          touched.current = false
          toastManager.add({
            title: "Approval stages saved",
            description: "New proposals use this campus order.",
            type: "success",
          })
        } catch (error) {
          const message = mutationErrorMessage(
            error,
            "Could not save approval stages."
          )
          setFormError(message)
          toastManager.add({
            title: "Could not save approval stages",
            description: message,
            type: "error",
          })
        }
      },
    } satisfies ApprovalStagesActions,
  }

  return (
    <ApprovalStagesContext.Provider value={value}>
      {children}
    </ApprovalStagesContext.Provider>
  )
}

export function useApprovalStagesPage() {
  const value = use(ApprovalStagesContext)
  if (!value) {
    throw new Error("useApprovalStagesPage must be used within ApprovalStagesProvider")
  }
  return value
}
