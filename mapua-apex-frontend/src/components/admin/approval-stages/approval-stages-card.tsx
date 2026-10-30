import { PlusIcon, StampIcon, Trash2Icon } from "lucide-react"
import { Link } from "react-router"

import {
  optionsForStage,
  useApprovalStagesPage,
} from "@/components/admin/approval-stages/approval-stages-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { layout } from "@/config"

const MAX_STAGES = 10

export function ApprovalStagesCard() {
  const { state, actions } = useApprovalStagesPage()

  return (
    <Card className={layout.card}>
      <CardHeader>
        <CardTitle>OSAAR approval stages</CardTitle>
        <CardDescription>
          {state.configured
            ? `New proposals need ${state.savedCount} OSAAR approval${state.savedCount === 1 ? "" : "s"}, in this order.`
            : "OSAAR approval stages are not saved yet. New proposals cannot be sent until you save at least one stage."}{" "}
          Saving applies only to proposals sent after this change. Proposals
          already sent keep the stages they were filed with.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {state.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : state.osaarPeople.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StampIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No OSAAR accounts yet</EmptyTitle>
              <EmptyDescription>
                Register an OSAAR signatory before choosing who signs each
                stage.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link to="/osaar/setup/signatories" />}>
                Add signatories
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          state.draft.map((stage, index) => {
            const options = optionsForStage(
              stage,
              state.draft,
              state.osaarPeople
            )
            const selected =
              options.find((option) => option.value === stage.signatoryId) ??
              null
            return (
              <Field key={stage.localId}>
                <FieldLabel>OSAAR {index + 1}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Select
                    itemToStringValue={(item) => item.value}
                    items={options}
                    onValueChange={(item) =>
                      actions.setStageSignatory(
                        stage.localId,
                        item?.value ?? ""
                      )
                    }
                    value={selected}
                  >
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue placeholder="Select OSAAR signatory" />
                    </SelectTrigger>
                    <SelectPopup>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                  <Button
                    aria-label={`Remove OSAAR ${index + 1}`}
                    disabled={state.draft.length <= 1 || state.savePending}
                    onClick={() => actions.removeStage(stage.localId)}
                    size="icon"
                    type="button"
                    variant="destructive-outline"
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              </Field>
            )
          })
        )}
        {state.formError ? (
          <Alert variant="error">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{state.formError}</AlertDescription>
          </Alert>
        ) : null}
        {!state.loading && state.osaarPeople.length > 0 && !state.canAddStage ? (
          <FieldDescription>
            {state.draft.length >= MAX_STAGES
              ? "OSAAR approval stages cannot exceed 10."
              : "Register another OSAAR signatory before adding a stage."}
          </FieldDescription>
        ) : null}
      </CardPanel>
      {state.osaarPeople.length > 0 && !state.loading ? (
        <CardFooter className="justify-between gap-2">
          <Button
            disabled={!state.canAddStage || state.savePending}
            onClick={actions.addStage}
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden="true" />
            Add OSAAR stage
          </Button>
          <Button
            disabled={!state.canSave}
            loading={state.savePending}
            onClick={() => {
              void actions.save()
            }}
            type="button"
          >
            Save stages
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
