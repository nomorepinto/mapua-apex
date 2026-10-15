import { CircleAlertIcon } from "lucide-react"

import { useMembersPage } from "@/components/students/members/members-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { modal } from "@/config"

export function EditMemberDialog() {
  const { state, actions } = useMembersPage()

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) actions.closeEdit()
      }}
      open={state.editing !== null}
    >
      <DialogPopup className={modal.dialogMd}>
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            The student number cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <Form className="contents" onSubmit={actions.handleEditSave}>
          <DialogPanel className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="edit-member-student-number">
                Student Number
              </FieldLabel>
              <Input
                disabled
                id="edit-member-student-number"
                readOnly
                type="text"
                value={state.editing?.student_number ?? ""}
              />
              <FieldDescription>Set when the member was added.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-member-lastname">Last name</FieldLabel>
              <Input
                autoComplete="off"
                id="edit-member-lastname"
                onChange={(event) =>
                  actions.changeEditLastname(event.currentTarget.value)
                }
                required
                type="text"
                value={state.editLastname}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-member-firstname">First name</FieldLabel>
              <Input
                autoComplete="off"
                id="edit-member-firstname"
                onChange={(event) =>
                  actions.changeEditFirstname(event.currentTarget.value)
                }
                required
                type="text"
                value={state.editFirstname}
              />
            </Field>
            {state.editError ? (
              <Alert variant="error">
                <CircleAlertIcon />
                <AlertTitle>Could not save</AlertTitle>
                <AlertDescription>{state.editError}</AlertDescription>
              </Alert>
            ) : null}
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
              Remove
            </Button>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={state.updatePending} type="submit">
              Save changes
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  )
}
