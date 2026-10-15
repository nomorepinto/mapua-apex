import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "apex_password_reset_lockout"
const COOLDOWN_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface LockoutData {
  lockUntil: number | null
}

function getStoredLockout(): LockoutData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lockUntil: null }
    const parsed = JSON.parse(raw)
    return {
      lockUntil: typeof parsed.lockUntil === "number" ? parsed.lockUntil : null,
    }
  } catch {
    return { lockUntil: null }
  }
}

function saveStoredLockout(data: LockoutData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error("Failed to persist password reset lockout state:", e)
  }
}

export function usePasswordResetLockout() {
  const [lockoutState, setLockoutState] = useState<LockoutData>(() => getStoredLockout())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)

  useEffect(() => {
    const checkLock = () => {
      const current = getStoredLockout()
      if (current.lockUntil) {
        const diff = Math.max(0, Math.ceil((current.lockUntil - Date.now()) / 1000))
        if (diff <= 0) {
          // Cooldown expired
          const resetData = { lockUntil: null }
          saveStoredLockout(resetData)
          setLockoutState(resetData)
          setRemainingSeconds(0)
        } else {
          setLockoutState(current)
          setRemainingSeconds(diff)
        }
      } else {
        setLockoutState(current)
        setRemainingSeconds(0)
      }
    }

    checkLock()
    const interval = setInterval(checkLock, 1000)
    return () => clearInterval(interval)
  }, [])

  const triggerLockout = useCallback(() => {
    const lockUntil = Date.now() + COOLDOWN_DURATION_MS
    const updated = { lockUntil }
    saveStoredLockout(updated)
    setLockoutState(updated)
    setRemainingSeconds(Math.ceil(COOLDOWN_DURATION_MS / 1000))
  }, [])

  const resetLockout = useCallback(() => {
    const cleared = { lockUntil: null }
    saveStoredLockout(cleared)
    setLockoutState(cleared)
    setRemainingSeconds(0)
  }, [])

  const isLocked = Boolean(lockoutState.lockUntil && remainingSeconds > 0)

  const formatRemaining = () => {
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return {
    isLocked,
    remainingSeconds,
    remainingFormatted: formatRemaining(),
    triggerLockout,
    resetLockout,
  }
}
