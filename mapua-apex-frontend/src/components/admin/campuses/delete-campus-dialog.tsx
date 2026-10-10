import { useCampusesPage } from "@/components/admin/campuses/campuses-context"
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

export function DeleteCampusDialog() {
  const { state, actions } = useCampusesPage()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this campus?</AlertDialogTitle>
          <AlertDialogDescription>
            {state.editing
              ? `${state.editing.name} will be permanently removed. A campus that still has reservable rooms or equipment cannot be deleted — remove those first. This cannot be undone.`
              : "This campus will be permanently removed. This cannot be undone."}
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
