import { useState } from "react"

import type { ApiCognitoAccount } from "@/lib/dynamodb-adapters"

export type AccountTarget = "signatory" | "organization"

export const EMPTY_ACCOUNTS: ApiCognitoAccount[] = []

export function accountDisplayName(account: ApiCognitoAccount): string {
  const name = account.name?.trim()
  if (name) return name
  const email = account.email?.trim()
  if (email) return email
  return account.username
}

export function accountsForTarget(
  accounts: ApiCognitoAccount[],
  target: AccountTarget,
  id: string
): ApiCognitoAccount[] {
  return accounts.filter((account) =>
    target === "signatory"
      ? account.signatory_id === id
      : account.organization_id === id
  )
}

export function accountSearchText(
  accounts: ApiCognitoAccount[],
  target: AccountTarget,
  id: string
): string {
  return accountsForTarget(accounts, target, id)
    .map((account) =>
      [accountDisplayName(account), account.email ?? "", account.username].join(
        " "
      )
    )
    .join(" ")
}

/**
 * True from the moment an assignment starts until the accounts refetch it
 * triggered has finished. A window-focus refetch does not count.
 */
export function useAssignmentSettling(
  isPending: boolean,
  isFetching: boolean
): boolean {
  const [followed, setFollowed] = useState(false)
  if (isPending && !followed) {
    setFollowed(true)
  } else if (followed && !isPending && !isFetching) {
    setFollowed(false)
  }
  return isPending || (followed && isFetching)
}
