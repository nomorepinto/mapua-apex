import { useOrganizationsPage } from "@/components/admin/organizations/organizations-context"
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

export function DeleteOrganizationDialog() {
  const { state, actions } = useOrganizationsPage()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
          <AlertDialogDescription>
            {state.editing
              ? `${state.editing.name} will be permanently removed. Organizations that still have submissions cannot be deleted. This cannot be undone.`
              : "This organization will be permanently removed. This cannot be undone."}
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
