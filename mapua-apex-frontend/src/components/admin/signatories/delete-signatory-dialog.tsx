import { useSignatoriesPage } from "@/components/admin/signatories/signatories-context"
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

export function DeleteSignatoryDialog() {
  const { state, actions } = useSignatoriesPage()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this signatory?</AlertDialogTitle>
          <AlertDialogDescription>
            {state.editing
              ? `${state.editing.name} will be permanently removed. People still assigned to an organization desk or holding a pending submission cannot be deleted. This cannot be undone.`
              : "This signatory will be permanently removed. This cannot be undone."}
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
