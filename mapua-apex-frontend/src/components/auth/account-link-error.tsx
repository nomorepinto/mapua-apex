import { Button } from "@/components/ui/button"
import { layout } from "@/config"
import { useSignOut } from "@/hooks/use-sign-out"
import { cn } from "@/lib/utils"

export function AccountLinkError() {
  const signOut = useSignOut()

  return (
    <div className={cn(layout.center, "flex-col p-4 text-center")}>
      <h1 className="text-xl font-bold text-red-700">Account link missing</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-600">
        This account has neither a signatory id nor an organization id. OSAAR
        must assign one of them before you can use the site.
      </p>
      <Button
        type="button"
        className="mt-6"
        onClick={() => {
          void signOut({ localOnly: true })
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
