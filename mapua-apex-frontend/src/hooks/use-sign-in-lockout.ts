import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "apex_signin_lockout"
const MAX_ATTEMPTS = 3
const COOLDOWN_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface LockoutData {
  count: number
  lockUntil: number | null
}

function getStoredLockout(): LockoutData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, lockUntil: null }
    const parsed = JSON.parse(raw)
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lockUntil: typeof parsed.lockUntil === "number" ? parsed.lockUntil : null,
    }
  } catch {
    return { count: 0, lockUntil: null }
  }
}

function saveStoredLockout(data: LockoutData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error("Failed to persist auth lockout state:", e)
  }
}

export function useSignInLockout() {
  const [lockoutState, setLockoutState] = useState<LockoutData>(() => getStoredLockout())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)

  // Calculate remaining seconds and check if expired
  useEffect(() => {
    const checkLock = () => {
      const current = getStoredLockout()
      if (current.lockUntil) {
        const diff = Math.max(0, Math.ceil((current.lockUntil - Date.now()) / 1000))
        if (diff <= 0) {
          // Lockout expired: reset
          const resetData = { count: 0, lockUntil: null }
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

  const recordFailedAttempt = useCallback(() => {
    const current = getStoredLockout()
    const newCount = current.count + 1

    if (newCount >= MAX_ATTEMPTS) {
      const lockUntil = Date.now() + COOLDOWN_DURATION_MS
      const updated = { count: newCount, lockUntil }
      saveStoredLockout(updated)
      setLockoutState(updated)
      setRemainingSeconds(Math.ceil(COOLDOWN_DURATION_MS / 1000))
    } else {
      const updated = { count: newCount, lockUntil: null }
      saveStoredLockout(updated)
      setLockoutState(updated)
    }
  }, [])

  const resetLockout = useCallback(() => {
    const cleared = { count: 0, lockUntil: null }
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
    failedCount: lockoutState.count,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - lockoutState.count),
    remainingSeconds,
    remainingFormatted: formatRemaining(),
    recordFailedAttempt,
    resetLockout,
    maxAttempts: MAX_ATTEMPTS,
  }
}
