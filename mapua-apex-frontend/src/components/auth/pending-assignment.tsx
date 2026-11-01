import { Button } from "@/components/ui/button"
import { layout } from "@/config"
import { useSignOut } from "@/hooks/use-sign-out"

export function PendingAssignment() {
  const signOut = useSignOut()

  return (
    <div className={layout.center}>
      <div className="flex max-w-md flex-col items-center space-y-4 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">
          Your account is awaiting assignment by OSAAR
        </h1>
        <p className="text-sm text-neutral-600">
          Signup is complete. OSAAR will link this account to an organization or
          a signatory desk. Sign in again after that link is in place.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void signOut({ localOnly: true })
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
