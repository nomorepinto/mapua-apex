import { useAuth } from "react-oidc-context"

import { Button } from "@/components/ui/button"
import { layout } from "@/config"

export function PendingAssignment() {
  const auth = useAuth()

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
            void auth.signoutRedirect()
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
