import { Building2Icon, PencilIcon } from "lucide-react"
import { Link } from "react-router"

import {
  ORGANIZATION_ASSIGNABLE_DESK_ITEMS,
  deskAssignment,
} from "@/components/admin-osa/signatory-roles"
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
import { cn } from "@/lib/utils"

export function OrganizationsTableCard() {
  const { state, actions } = useOrganizationsPage()

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle>Registered organizations</CardTitle>
        <CardDescription>
          {state.directoryLoading
            ? "Loading…"
            : `${state.organizations.length} organization${
                state.organizations.length === 1 ? "" : "s"
              } · use Edit to update a row`}
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
                Register shared admin, CDM, and OSAAR accounts, then assign a
                dean and adviser to each organization.
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
            <div className="text-muted-foreground border-b px-6 py-3 text-sm">
              Shared desks: Admin {state.sharedAdminName} · CDM{" "}
              {state.sharedCdmName} · OSAAR {state.sharedOsaarName}
            </div>
            <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Dean</TableHead>
                    <TableHead>Adviser</TableHead>
                    <TableHead>Higher council</TableHead>
                    <TableHead className="w-28 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.filtered.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={5}>
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
