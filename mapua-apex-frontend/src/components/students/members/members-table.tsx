import { PencilIcon, UsersIcon } from "lucide-react"

import { useMembersPage } from "@/components/students/members/members-context"
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

export function MembersTableCard() {
  const { state, actions } = useMembersPage()

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle>Organization members</CardTitle>
        <CardDescription>
          {state.loading
            ? "Loading…"
            : `${state.members.length} member${
                state.members.length === 1 ? "" : "s"
              }`}
        </CardDescription>
        <CardAction>
          <Input
            aria-label="Search members"
            className="w-full min-w-0 sm:w-56"
            onChange={(event) => actions.setSearch(event.currentTarget.value)}
            placeholder="Search name or number"
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
        ) : state.members.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No members yet</EmptyTitle>
              <EmptyDescription>
                Add students individually or import a CSV to build your
                organization roster.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Number</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.filtered.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>
                      No members match &ldquo;{state.search}&rdquo;.
                    </TableCell>
                  </TableRow>
                ) : (
                  state.filtered.map((member) => (
                    <TableRow
                      className="cursor-pointer"
                      key={member.student_number}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        actions.openEdit(member)
                      }}
                    >
                      <TableCell className="font-mono text-sm">
                        {member.student_number}
                      </TableCell>
                      <TableCell>{member.lastname}</TableCell>
                      <TableCell>{member.firstname}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => actions.openEdit(member)}
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
