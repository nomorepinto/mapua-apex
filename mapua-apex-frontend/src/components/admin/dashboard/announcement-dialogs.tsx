import { CircleAlertIcon } from "lucide-react"

import {
  ANNOUNCEMENT_MAX,
  formatAnnouncementPostedAt,
  useAdminDashboard,
} from "@/components/admin/dashboard/admin-dashboard-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { brand, modal } from "@/config"
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export function SubmissionDetailDialog() {
  const { state, actions } = useAdminDashboard()
  const { selectedRow } = state

  return (
    <Dialog
      open={state.selectedKeys !== null}
      onOpenChange={(open) => {
        if (!open) actions.closeSubmission()
      }}
    >
      <DialogPopup
        className={cn(
          modal.dialog,
          "max-w-3xl overflow-x-hidden [&_button[aria-label=Close]]:text-white [&_button[aria-label=Close]]:hover:bg-white/15 [&_button[aria-label=Close]]:hover:text-white"
        )}
      >
        <DialogHeader className="shrink-0 rounded-t-2xl bg-[#8B0000] px-6 py-5 pb-6! text-white in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-6 max-sm:rounded-none">
          <div className="flex min-w-0 flex-wrap items-center gap-2 pe-8">
            {selectedRow ? (
              <span className={cn(brand.chipGold, "max-w-full wrap-anywhere")}>
                {selectedRow.organization_name || "Organization"}
              </span>
            ) : null}
            {selectedRow ? (
              <span className="rounded-sm bg-white/15 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                {selectedRow.status}
              </span>
            ) : null}
          </div>
          <DialogTitle className="pe-8 text-xl font-extrabold tracking-tight wrap-anywhere text-white sm:text-2xl">
            {selectedRow?.activity_details.title || "Submission detail"}
          </DialogTitle>
          <DialogDescription className="wrap-anywhere text-[#FBC02D]">
            {selectedRow
              ? `${formatDocumentId(selectedRow.submission_id)} · ${selectedRow.current_signatory}`
              : "Loading the full SAAF record and notifications."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex min-w-0 flex-col gap-5 overflow-x-hidden pt-6! text-sm in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-6">
          {state.detailLoading ? (
            <p className="text-sm text-neutral-600">Loading record…</p>
          ) : state.detailError ? (
            <p className="text-sm font-semibold text-rose-600">
              Could not load this submission.
            </p>
          ) : selectedRow ? (
            <>
              <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                {[
                  ["Organization", selectedRow.organization_name || "—"],
                  ["Venue", selectedRow.activity_details.venue || "—"],
                  ["Date", selectedRow.activity_details.date || "—"],
                  ["Budget", selectedRow.activity_details.budget || "—"],
                  ["Submitted", selectedRow.submitted_date || "—"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-3"
                  >
                    <dt className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 font-semibold wrap-anywhere text-neutral-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <section className="min-w-0">
                <h3 className="mb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">
                  Description
                </h3>
                <div className="max-h-48 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-xl border border-neutral-200 bg-[#F8FAFC] p-4">
                  <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap text-neutral-700">
                    {selectedRow.activity_details.description ||
                      "No description provided."}
                  </p>
                </div>
              </section>
              <section className="min-w-0">
                <h3 className="mb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">
                  Notifications
                </h3>
                {state.stepper.assigneesList.length === 0 ? (
                  <p className="text-sm text-neutral-600">
                    No review notifications yet.
                  </p>
                ) : (
                  <ul className="flex min-w-0 flex-col gap-2">
                    {state.stepper.assigneesList.map((item, index) => (
                      <li
                        key={`${item.role}-${index}`}
                        className="min-w-0 rounded-xl border border-neutral-200 px-3.5 py-3"
                      >
                        <p className="font-semibold wrap-anywhere text-neutral-900">
                          {item.name}
                        </p>
                        <p className="text-sm wrap-anywhere text-neutral-600">
                          {item.statusText}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

export function CreateAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <Dialog open={state.createOpen} onOpenChange={actions.setCreateOpen}>
      <DialogPopup className={modal.dialogMd}>
        <Form className="contents" onSubmit={actions.handleCreate}>
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Posted notices are visible on the institutional bulletin.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field data-invalid={state.createError ? true : undefined}>
              <FieldLabel htmlFor="announcement-content">Content</FieldLabel>
              <Textarea
                aria-invalid={state.createError ? true : undefined}
                id="announcement-content"
                maxLength={ANNOUNCEMENT_MAX}
                onChange={(event) =>
                  actions.setCreateContent(event.currentTarget.value)
                }
                required
                rows={6}
                value={state.createContent}
              />
              <FieldDescription>
                {state.createContent.length}/{ANNOUNCEMENT_MAX}
              </FieldDescription>
              {state.createError ? <FieldError>{state.createError}</FieldError> : null}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={state.createPending} type="submit">
              Post announcement
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  )
}

export function EditAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <Dialog
      open={state.editing !== null}
      onOpenChange={(open) => {
        if (!open) actions.closeEdit()
      }}
    >
      <DialogPopup className={modal.dialogMd}>
        <Form className="contents" onSubmit={actions.handleEdit}>
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
            <DialogDescription>
              {state.editing
                ? `Posted ${formatAnnouncementPostedAt(state.editing.sent_at)}`
                : "Update this notice."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field data-invalid={state.editError ? true : undefined}>
              <FieldLabel htmlFor="edit-announcement-content">Content</FieldLabel>
              <Textarea
                aria-invalid={state.editError ? true : undefined}
                id="edit-announcement-content"
                maxLength={ANNOUNCEMENT_MAX}
                onChange={(event) =>
                  actions.setEditContent(event.currentTarget.value)
                }
                required
                rows={6}
                value={state.editContent}
              />
              <FieldDescription>
                {state.editContent.length}/{ANNOUNCEMENT_MAX}
              </FieldDescription>
              {state.editError ? <FieldError>{state.editError}</FieldError> : null}
            </Field>
            {state.deleteError ? (
              <Alert variant="error">
                <CircleAlertIcon />
                <AlertTitle>Could not delete</AlertTitle>
                <AlertDescription>{state.deleteError}</AlertDescription>
              </Alert>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              onClick={actions.openDelete}
              type="button"
              variant="destructive-outline"
            >
              Delete
            </Button>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={state.editPending} type="submit">
              Save changes
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  )
}

export function DeleteAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
          <AlertDialogDescription>
            This notice will be removed from the bulletin. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="ghost" />}>
            Keep
          </AlertDialogClose>
          <Button
            loading={state.deletePending}
            onClick={actions.handleDelete}
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
