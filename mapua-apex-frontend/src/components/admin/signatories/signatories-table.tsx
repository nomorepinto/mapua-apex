import { PencilIcon, StampIcon } from "lucide-react"

import { signatoryRoleLabel } from "@/components/admin-osa/signatory-roles"
import { useSignatoriesPage } from "@/components/admin/signatories/signatories-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
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
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export function SignatoriesTableCard() {
  const { state, actions } = useSignatoriesPage()

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle>Registered signatories</CardTitle>
        <CardDescription>
          {state.loading
            ? "Loading…"
            : `${state.signatories.length} signator${
                state.signatories.length === 1 ? "y" : "ies"
              } · sorted by role · use Edit to update a row`}
        </CardDescription>
      </CardHeader>
      <CardPanel className="p-0">
        {state.loading ? (
          <div className="space-y-2 px-6 pb-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : state.signatories.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StampIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No signatories yet</EmptyTitle>
              <EmptyDescription>
                Add a name and role on the left. Organizations need shared
                admin, CDM, and OSAAR accounts before they can be registered.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
            <Input
              aria-label="Search signatories"
              className="mb-3 w-full min-w-0 sm:w-64"
              onChange={(event) => actions.setSearch(event.currentTarget.value)}
              placeholder="Search all columns"
              type="search"
              value={state.search}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.filtered.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No signatories match “{state.search}”.
                    </TableCell>
                  </TableRow>
                ) : (
                  state.filtered.map((person) => (
                    <TableRow
                      className="cursor-pointer"
                      key={person.signatory_id}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        actions.openEdit(person)
                      }}
                    >
                      <TableCell
                        className="font-mono text-xs whitespace-nowrap"
                        title={person.signatory_id}
                      >
                        {formatDocumentId(person.signatory_id, "SIG")}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal">
                        {person.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {signatoryRoleLabel(person.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {person.role === "dean" && person.department ? (
                          <Badge variant="outline">
                            {person.department.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => actions.openEdit(person)}
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
        )}
      </CardPanel>
    </Card>
  )
}
