import { ChevronDownIcon, ChevronUpIcon, StampIcon } from "lucide-react"
import { Link } from "react-router"

import { useApprovalStagesPage } from "@/components/admin/approval-stages/approval-stages-context"
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
import { Skeleton } from "@/components/ui/skeleton"
import { layout } from "@/config"

export function ApprovalStagesCard() {
  const { state, actions } = useApprovalStagesPage()
  const hasPeople =
    state.groups.some((group) => group.ids.length > 0) ||
    state.allCampusName !== null ||
    state.unassigned.length > 0

  return (
    <Card className={layout.card}>
      <CardHeader>
        <CardTitle>OSAAR approval stages</CardTitle>
        <CardDescription>
          Each campus approves in the order below. The all-campus account
          approves after that campus&apos;s OSAARs. Saving applies only to
          proposals sent after this change. Proposals already sent keep the
          stages they were filed with.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-6">
        {state.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !hasPeople ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StampIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No OSAAR accounts yet</EmptyTitle>
              <EmptyDescription>
                Register an OSAAR signatory and choose their campus before
                setting the approval order.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link to="/osaar/setup/signatories" />}>
                Add signatories
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {state.groups.map((group) => (
              <section className="flex flex-col gap-2" key={group.campusId}>
                <h3 className="text-sm font-semibold">{group.campusName}</h3>
                {group.ids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No OSAAR accounts are assigned to this campus.
                  </p>
                ) : (
                  group.ids.map((id, index) => (
                    <div
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      key={id}
                    >
                      <span className="w-6 text-sm text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {group.names[id] || "Removed signatory"}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {group.campusName}
                      </span>
                      <Button
                        aria-label={`Move ${group.names[id] || "OSAAR"} up`}
                        disabled={index === 0 || state.savePending}
                        onClick={() => actions.move(group.campusId, index, -1)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <ChevronUpIcon aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label={`Move ${group.names[id] || "OSAAR"} down`}
                        disabled={
                          index === group.ids.length - 1 || state.savePending
                        }
                        onClick={() => actions.move(group.campusId, index, 1)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <ChevronDownIcon aria-hidden="true" />
                      </Button>
                    </div>
                  ))
                )}
              </section>
            ))}
            {state.unassigned.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">No campus</h3>
                {state.unassigned.map((person) => (
                  <div
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    key={person.signatoryId}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {person.name}
                    </span>
                    <span className="text-sm text-muted-foreground">No campus</span>
                  </div>
                ))}
              </section>
            ) : null}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">After the campus OSAARs</h3>
              {state.allCampusName ? (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {state.allCampusName}
                  </span>
                  <span className="text-sm text-muted-foreground">All campuses</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No OSAAR account receives every campus yet. New proposals
                  cannot be sent until one is assigned to all campuses.
                </p>
              )}
            </section>
          </>
        )}
        {state.formError ? (
          <Alert variant="error">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{state.formError}</AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      {hasPeople && !state.loading ? (
        <CardFooter className="justify-end">
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
