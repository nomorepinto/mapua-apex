import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type AppRole = "students" | "signatories" | "admin"

// Keeping store around in case it's needed for other session data later
export type SessionState = {
  // Add other session state here
}

export const ROLE_LABELS: Record<AppRole, string> = {
  students: "Student organization",
  signatories: "Signatory",
  admin: "Office of Student Affairs",
}

export const useSessionStore = create<SessionState>()(
  persist(
    () => ({
      // initial state
    }),
    {
      name: "apex-session-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
