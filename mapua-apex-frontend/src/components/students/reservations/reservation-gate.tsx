import type { ReactNode } from "react"
import { Navigate, useSearchParams } from "react-router"

import { useOrgStore } from "@/stores/org-store"

export function ReservationGate({ children }: { children: ReactNode }) {
  const reserveFacilities = useOrgStore((state) => state.reserveFacilities)
  const saafValidated = useOrgStore((state) => state.saafValidated)
  const [searchParams] = useSearchParams()

  if (reserveFacilities !== "yes" || !saafValidated) {
    const query = searchParams.toString()
    return (
      <Navigate
        to={`/students/submissions/saaf${query ? `?${query}` : ""}`}
        replace
      />
    )
  }

  return children
}
