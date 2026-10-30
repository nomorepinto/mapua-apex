/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { optionsForRole } from "@/components/admin-osa/signatory-roles"
import { toastManager } from "@/components/ui/toast"
import {
  mutationErrorMessage,
  useApprovalSettingsQuery,
  useSignatoriesQuery,
  useUpdateApprovalSettingsMutation,
} from "@/hooks/use-admin"
import type { ApiOsaarStage, ApiSignatory } from "@/lib/dynamodb-adapters"

const MAX_STAGES = 10
const EMPTY_SIGNATORIES: ApiSignatory[] = []

export interface DraftOsaarStage {
  localId: string
  signatoryId: string
  fallbackName: string
}

interface ApprovalStagesState {
  loading: boolean
  loadError: string | null
  savedCount: number
  configured: boolean
  draft: DraftOsaarStage[]
  osaarPeople: ApiSignatory[]
  formError: string
  savePending: boolean
  dirty: boolean
  canAddStage: boolean
  canSave: boolean
}

interface ApprovalStagesActions {
  setStageSignatory: (localId: string, signatoryId: string) => void
  addStage: () => void
  removeStage: (localId: string) => void
  save: () => Promise<void>
}

const ApprovalStagesContext = createContext<{
  state: ApprovalStagesState
  actions: ApprovalStagesActions
} | null>(null)

function draftFromStages(stages: ApiOsaarStage[]): DraftOsaarStage[] {
  if (stages.length === 0) {
    return [{ localId: "stage-1", signatoryId: "", fallbackName: "" }]
  }
  return stages.map((stage) => ({
    localId: stage.key,
    signatoryId: stage.signatory_id,
    fallbackName: stage.signatory_name,
  }))
}

function sameDraft(left: DraftOsaarStage[], right: DraftOsaarStage[]): boolean {
  if (left.length !== right.length) return false
  return left.every(
    (stage, index) => stage.signatoryId === right[index]?.signatoryId
  )
}

export function ApprovalStagesProvider({ children }: { children: ReactNode }) {
  const settingsQuery = useApprovalSettingsQuery()
  const signatoriesQuery = useSignatoriesQuery()
  const updateSettings = useUpdateApprovalSettingsMutation()
  const nextId = useRef(1)
  const [draft, setDraft] = useState<DraftOsaarStage[]>([])
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null)
  const [formError, setFormError] = useState("")

  const settings = settingsQuery.data
  const signature = settings
    ? settings.osaar_stages
        .map((stage) => `${stage.key}:${stage.signatory_id}`)
        .join("|")
    : null
  const serverDraft = settings ? draftFromStages(settings.osaar_stages) : []
  if (settings && signature !== hydratedFrom) {
    setHydratedFrom(signature)
    setDraft(serverDraft)
    setFormError("")
  }
  const resolvedDraft =
    settings && signature !== hydratedFrom ? serverDraft : draft

  const signatories = signatoriesQuery.data ?? EMPTY_SIGNATORIES
  const osaarPeople = useMemo(
    () => signatories.filter((person) => person.role === "osaar"),
    [signatories]
  )
  const savedCount = settings?.osaar_stages.length ?? 0
  const takenElsewhere = (localId: string) =>
    new Set(
      resolvedDraft
        .filter((stage) => stage.localId !== localId && stage.signatoryId)
        .map((stage) => stage.signatoryId)
    )
  const unusedPeople = osaarPeople.filter(
    (person) =>
      !resolvedDraft.some((stage) => stage.signatoryId === person.signatory_id)
  )
  const dirty = settings ? !sameDraft(resolvedDraft, serverDraft) : false
  const canAddStage =
    resolvedDraft.length < MAX_STAGES &&
    resolvedDraft.length < osaarPeople.length &&
    unusedPeople.length > 0

  const value = {
    state: {
      loading: settingsQuery.isLoading || signatoriesQuery.isLoading,
      loadError:
        settingsQuery.isError || signatoriesQuery.isError
          ? mutationErrorMessage(
              settingsQuery.error ?? signatoriesQuery.error,
              "Approval stages failed to load."
            )
          : null,
      savedCount,
      configured: savedCount > 0,
      draft: resolvedDraft,
      osaarPeople,
      formError,
      savePending: updateSettings.isPending,
      dirty,
      canAddStage,
      canSave:
        dirty &&
        resolvedDraft.length > 0 &&
        resolvedDraft.every((stage) => stage.signatoryId !== "") &&
        new Set(resolvedDraft.map((stage) => stage.signatoryId)).size ===
          resolvedDraft.length,
    } satisfies ApprovalStagesState,
    actions: {
      setStageSignatory: (localId: string, signatoryId: string) => {
        if (takenElsewhere(localId).has(signatoryId)) {
          return
        }
        setDraft((current) =>
          current.map((stage) =>
            stage.localId === localId
              ? { ...stage, signatoryId, fallbackName: "" }
              : stage
          )
        )
        setFormError("")
      },
      addStage: () => {
        setDraft((current) => {
          if (current.length >= MAX_STAGES) return current
          nextId.current += 1
          return [
            ...current,
            {
              localId: `new-${nextId.current}`,
              signatoryId: "",
              fallbackName: "",
            },
          ]
        })
        setFormError("")
      },
      removeStage: (localId: string) => {
        setDraft((current) =>
          current.length <= 1
            ? current
            : current.filter((stage) => stage.localId !== localId)
        )
        setFormError("")
      },
      save: async () => {
        const ids = resolvedDraft.map((stage) => stage.signatoryId)
        if (ids.some((id) => id === "")) {
          setFormError("Choose a signatory for every OSAAR stage.")
          return
        }
        if (new Set(ids).size !== ids.length) {
          setFormError("Each OSAAR stage must be a different signatory.")
          return
        }
        try {
          await updateSettings.mutateAsync(ids)
          toastManager.add({
            title: "Approval stages saved",
            description:
              ids.length === 1
                ? "New proposals need 1 OSAAR approval."
                : `New proposals need ${ids.length} OSAAR approvals, in order.`,
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

export function optionsForStage(
  stage: DraftOsaarStage,
  draft: DraftOsaarStage[],
  people: ApiSignatory[]
) {
  const taken = new Set(
    draft
      .filter((row) => row.localId !== stage.localId && row.signatoryId)
      .map((row) => row.signatoryId)
  )
  const options = optionsForRole(people, "osaar").filter(
    (option) => !taken.has(option.value)
  )
  if (
    stage.signatoryId &&
    !options.some((option) => option.value === stage.signatoryId)
  ) {
    options.unshift({
      label: stage.fallbackName || "Removed signatory",
      value: stage.signatoryId,
    })
  }
  return options
}
