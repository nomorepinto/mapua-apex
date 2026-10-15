import { useMembersPage } from "@/components/students/members/members-context"
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

export function DeleteMemberDialog() {
  const { state, actions } = useMembersPage()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription>
            {state.editing
              ? `${state.editing.firstname} ${state.editing.lastname} (${state.editing.student_number}) will be removed from the roster. This cannot be undone.`
              : "This member will be removed from the roster. This cannot be undone."}
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
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
