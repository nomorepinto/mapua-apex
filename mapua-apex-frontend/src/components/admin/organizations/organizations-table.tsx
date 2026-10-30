import { Building2Icon, PencilIcon } from "lucide-react"
import { Link } from "react-router"

import {
  ORGANIZATION_ASSIGNABLE_DESK_ITEMS,
  deskAssignment,
} from "@/components/admin-osa/signatory-roles"
import {
  EMPTY_ACCOUNTS,
  useAssignmentSettling,
} from "@/components/admin/accounts/account-assignment"
import {
  AccountAssignmentCombobox,
  AccountAssignmentSkeleton,
} from "@/components/admin/accounts/account-assignment-combobox"
import { DeskName } from "@/components/admin/organizations/organization-fields"
import { useOrganizationsPage } from "@/components/admin/organizations/organizations-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
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
import { Input } from "@/components/ui/input"
import { toastManager } from "@/components/ui/toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { layout } from "@/config"
import {
  mutationErrorMessage,
  useAssignOrganizationAccountMutation,
  useCognitoAccountsQuery,
} from "@/hooks/use-admin"
import { cn } from "@/lib/utils"

export function OrganizationsTableCard() {
  const { state, actions } = useOrganizationsPage()
  const accountsQuery = useCognitoAccountsQuery()
  const assignAccount = useAssignOrganizationAccountMutation()
  const settling = useAssignmentSettling(
    assignAccount.isPending,
    accountsQuery.isFetching
  )
  const accountsBusy =
    accountsQuery.isLoading || settling || assignAccount.isPending
  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle>Registered organizations</CardTitle>
        <CardDescription>
          {state.directoryLoading
            ? "Loading…"
            : `${state.organizations.length} organization${
                state.organizations.length === 1 ? "" : "s"
              } · a new account applies the next time that person signs in`}
        </CardDescription>
        <CardAction>
          <Input
            aria-label="Search organizations and signatories"
            className="w-full min-w-0 sm:w-56"
            onChange={(event) => actions.setSearch(event.currentTarget.value)}
            placeholder="Search name or signatory"
            type="search"
            value={state.search}
          />
        </CardAction>
      </CardHeader>
      <CardPanel className="p-0">
        {state.directoryLoading ? (
          <div className="space-y-2 px-6 pb-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : state.organizations.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No organizations yet</EmptyTitle>
              <EmptyDescription>
                Register a CDM account, then assign a dean and an adviser to
                each organization.
              </EmptyDescription>
            </EmptyHeader>
            {!state.sharedAccountsReady ? (
              <EmptyContent>
                <Button render={<Link to="/osaar/setup/signatories" />}>
                  Add signatories
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <>
            <div className="border-b px-6 py-3 text-sm text-muted-foreground">
              Shared desk: CDM {state.sharedCdmName}
            </div>
            <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Dean</TableHead>
                    <TableHead>Adviser</TableHead>
                    <TableHead>Higher council</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-28 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.filtered.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={6}>
                        No organizations match “{state.search}”.
                      </TableCell>
                    </TableRow>
                  ) : (
                    state.filtered.map((org) => (
                      <TableRow
                        className="cursor-pointer"
                        key={org.organization_id}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          actions.openEdit(org)
                        }}
                      >
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{org.name}</div>
                        </TableCell>
                        {ORGANIZATION_ASSIGNABLE_DESK_ITEMS.map((item) => {
                          const signatoryId = deskAssignment(org, item.value)
                          return (
                            <TableCell key={item.value}>
                              <DeskName
                                person={
                                  signatoryId
                                    ? state.peopleById.get(signatoryId)
                                    : undefined
                                }
                                signatoryId={signatoryId}
                              />
                            </TableCell>
                          )
                        })}
                        <TableCell>
                          {org.is_higher_council ? "Yes" : "—"}
                        </TableCell>
                        <TableCell
                          onContextMenu={(event) => event.stopPropagation()}
                        >
                          {accountsQuery.isLoading ||
                          settling ||
                          (assignAccount.isPending &&
                            assignAccount.variables?.organizationId ===
                              org.organization_id) ? (
                            <AccountAssignmentSkeleton />
                          ) : accountsQuery.isError ? (
                            <span className="text-sm text-muted-foreground">
                              Accounts unavailable
                            </span>
                          ) : (
                            <AccountAssignmentCombobox
                              accounts={accounts}
                              busy={accountsBusy}
                              onAssign={(username) =>
                                assignAccount.mutate(
                                  {
                                    organizationId: org.organization_id,
                                    username,
                                  },
                                  {
                                    onError: (error) =>
                                      toastManager.add({
                                        title: "Could not assign account",
                                        description: mutationErrorMessage(
                                          error,
                                          "Request failed."
                                        ),
                                        type: "error",
                                      }),
                                  }
                                )
                              }
                              target="organization"
                              targetId={org.organization_id}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => actions.openEdit(org)}
                          >
                            <PencilIcon />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardPanel>
    </Card>
  )
}
