import { Building2Icon, PencilIcon } from "lucide-react"

import { useCampusesPage } from "@/components/admin/campuses/campuses-context"
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

export function CampusesTableCard() {
  const { state, actions } = useCampusesPage()

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle>Registered campuses</CardTitle>
        <CardDescription>
          {state.loading
            ? "Loading…"
            : `${state.campuses.length} campus${
                state.campuses.length === 1 ? "" : "es"
              } · use Edit to rename a row`}
        </CardDescription>
        <CardAction>
          <Input
            aria-label="Search campuses"
            className="w-full min-w-0 sm:w-56"
            onChange={(event) => actions.setSearch(event.currentTarget.value)}
            placeholder="Search name"
            type="search"
            value={state.search}
          />
        </CardAction>
      </CardHeader>
      <CardPanel className="p-0">
        {state.loading ? (
          <div className="space-y-2 px-6 pb-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : state.campuses.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No campuses yet</EmptyTitle>
              <EmptyDescription>
                Add a campus to start registering its reservable rooms and
                equipment.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campus</TableHead>
                  <TableHead className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.filtered.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={2}>
                      No campuses match “{state.search}”.
                    </TableCell>
                  </TableRow>
                ) : (
                  state.filtered.map((campus) => (
                    <TableRow
                      className="cursor-pointer"
                      key={campus.campus_id}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        actions.openEdit(campus)
                      }}
                    >
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{campus.name}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => actions.openEdit(campus)}
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
