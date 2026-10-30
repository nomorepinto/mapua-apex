import { useMemo } from "react"

import {
  accountDisplayName,
  accountsForTarget,
  EMPTY_ACCOUNTS,
  type AccountTarget,
} from "@/components/admin/accounts/account-assignment"
import { Badge } from "@/components/ui/badge"
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganizationsQuery, useSignatoriesQuery } from "@/hooks/use-admin"
import type {
  ApiCognitoAccount,
  ApiOrganization,
  ApiSignatory,
} from "@/lib/dynamodb-adapters"

interface AccountChoice {
  hint: string | null
  label: string
  value: string
}

const EMPTY_SIGNATORIES: ApiSignatory[] = []
const EMPTY_ORGANIZATIONS: ApiOrganization[] = []

export function AccountAssignmentCombobox({
  accounts,
  busy,
  onAssign,
  target,
  targetId,
}: {
  accounts: ApiCognitoAccount[]
  busy: boolean
  onAssign: (username: string | null) => void
  target: AccountTarget
  targetId: string
}) {
  const signatories = useSignatoriesQuery().data ?? EMPTY_SIGNATORIES
  const organizations = useOrganizationsQuery().data ?? EMPTY_ORGANIZATIONS
  const listedAccounts = accounts.length > 0 ? accounts : EMPTY_ACCOUNTS
  const holders = accountsForTarget(listedAccounts, target, targetId)
  const primary = holders[0]
  const extra = holders.length - 1
  const items = useMemo(
    () =>
      listedAccounts.map((account) =>
        choiceFor(account, target, targetId, signatories, organizations)
      ),
    [listedAccounts, organizations, signatories, target, targetId]
  )
  const selected = primary
    ? (items.find((item) => item.value === primary.username) ?? null)
    : null

  return (
    <div className="flex min-w-56 items-center gap-2">
      <Combobox
        disabled={busy}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        items={items}
        onValueChange={(item) => onAssign(item?.value ?? null)}
        value={selected}
      >
        <ComboboxInput
          aria-label="Assigned account"
          disabled={busy}
          placeholder="Unassigned"
          showClear={selected !== null}
        />
        <ComboboxPopup>
          <ComboboxEmpty>No matching account.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.hint ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      {extra > 0 ? (
        <Badge
          variant="outline"
          title={holders
            .slice(1)
            .map((account) => accountDisplayName(account))
            .join(", ")}
        >
          +{extra}
        </Badge>
      ) : null}
    </div>
  )
}

export function AccountAssignmentSkeleton() {
  return <Skeleton className="h-8 w-full min-w-56" />
}

function choiceFor(
  account: ApiCognitoAccount,
  target: AccountTarget,
  targetId: string,
  signatories: ApiSignatory[],
  organizations: ApiOrganization[]
): AccountChoice {
  return {
    label: accountDisplayName(account),
    value: account.username,
    hint: linkHint(account, target, targetId, signatories, organizations),
  }
}

function linkHint(
  account: ApiCognitoAccount,
  target: AccountTarget,
  targetId: string,
  signatories: ApiSignatory[],
  organizations: ApiOrganization[]
): string | null {
  if (
    account.signatory_id &&
    !(target === "signatory" && account.signatory_id === targetId)
  ) {
    const person = signatories.find(
      (item) => item.signatory_id === account.signatory_id
    )
    return `Currently ${person?.name ?? "another signatory"}`
  }
  if (
    account.organization_id &&
    !(target === "organization" && account.organization_id === targetId)
  ) {
    const org = organizations.find(
      (item) => item.organization_id === account.organization_id
    )
    return `Currently ${org?.name ?? "another organization"}`
  }
  const email = account.email?.trim()
  if (email && email !== accountDisplayName(account)) {
    return email
  }
  return null
}
