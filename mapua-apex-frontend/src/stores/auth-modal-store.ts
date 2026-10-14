import { create } from "zustand"

export type AuthModalView = "none" | "signIn" | "signUp" | "verifyEmail" | "forgotPassword"

interface AuthModalState {
  view: AuthModalView
  verificationEmail: string
  openSignIn: () => void
  openSignUp: () => void
  openVerifyEmail: (email: string) => void
  openForgotPassword: () => void
  closeModal: () => void
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  view: "none",
  verificationEmail: "",
  openSignIn: () => set({ view: "signIn" }),
  openSignUp: () => set({ view: "signUp" }),
  openVerifyEmail: (email: string) => set({ view: "verifyEmail", verificationEmail: email }),
  openForgotPassword: () => set({ view: "forgotPassword" }),
  closeModal: () => set({ view: "none" }),
}))
