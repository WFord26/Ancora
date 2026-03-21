"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface TimerClient {
  id: string
  companyName: string
}

interface TimerRetainer {
  id: string
  name: string
  clientId: string
}

interface TimerCategory {
  id: string
  name: string
}

interface TimerProps {
  clients: TimerClient[]
  retainers: TimerRetainer[]
  categories: TimerCategory[]
  userTimezone: string
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function FloatingTimer({
  clients,
  retainers,
  categories,
  userTimezone,
}: TimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)

  // Form state
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedRetainerId, setSelectedRetainerId] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [isBillable, setIsBillable] = useState(true)
  const [isTravelTime, setIsTravelTime] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filter retainers by selected client
  const filteredRetainers = retainers.filter(
    (r) => r.clientId === selectedClientId
  )

  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // Timer tick
  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime.getTime())
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, startTime])

  const handleStart = useCallback(() => {
    if (!selectedClientId || !selectedRetainerId) {
      setError("Select a client and retainer first")
      return
    }
    setError("")
    setSuccess("")
    const now = new Date()
    setStartTime(now)
    setElapsed(0)
    setIsRunning(true)
    setIsExpanded(false)
  }, [selectedClientId, selectedRetainerId])

  const handleStop = useCallback(async () => {
    if (!startTime || !isRunning) return

    const endTime = new Date()
    const durationMs = endTime.getTime() - startTime.getTime()

    if (durationMs < 60000) {
      setError("Timer must run for at least 1 minute")
      return
    }

    if (!description.trim()) {
      setIsExpanded(true)
      setError("Enter a description before stopping")
      return
    }

    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setIsSaving(true)
    setError("")

    try {
      const res = await fetch("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retainerId: selectedRetainerId,
          clientId: selectedClientId,
          categoryId: selectedCategoryId || undefined,
          startUtc: startTime.toISOString(),
          endUtc: endTime.toISOString(),
          durationMs,
          userTimezone,
          externalDescription: description.trim(),
          internalNotes: internalNotes.trim() || undefined,
          isBillable,
          isTravelTime,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save")
      }

      setSuccess(`Saved ${formatDuration(durationMs)}`)
      setDescription("")
      setInternalNotes("")
      setStartTime(null)
      setElapsed(0)

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save")
      // Resume timer so user doesn't lose time
      setIsRunning(true)
    } finally {
      setIsSaving(false)
    }
  }, [
    startTime,
    isRunning,
    description,
    selectedRetainerId,
    selectedClientId,
    selectedCategoryId,
    internalNotes,
    isBillable,
    isTravelTime,
    userTimezone,
  ])

  const handleDiscard = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setStartTime(null)
    setElapsed(0)
    setDescription("")
    setInternalNotes("")
    setError("")
    setSuccess("")
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-3 w-80 rounded-xl border bg-card p-4 shadow-lg"
          >
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="timer-client"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Client
                </label>
                <select
                  id="timer-client"
                  aria-label="Select client"
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value)
                    setSelectedRetainerId("")
                  }}
                  disabled={isRunning}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="timer-retainer"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Retainer
                </label>
                <select
                  id="timer-retainer"
                  aria-label="Select retainer"
                  value={selectedRetainerId}
                  onChange={(e) => setSelectedRetainerId(e.target.value)}
                  disabled={isRunning || !selectedClientId}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select retainer...</option>
                  {filteredRetainers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="timer-category"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Category (optional)
                </label>
                <select
                  id="timer-category"
                  aria-label="Select category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="timer-description"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Description (client-visible)
                </label>
                <textarea
                  id="timer-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="What are you working on?"
                />
              </div>

              <div>
                <label
                  htmlFor="timer-notes"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Internal Notes (optional)
                </label>
                <textarea
                  id="timer-notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={1}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Staff-only notes..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="timer-billable"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                <label
                  htmlFor="timer-billable"
                  className="text-sm text-muted-foreground"
                >
                  Billable
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="timer-travel"
                  checked={isTravelTime}
                  onChange={(e) => setIsTravelTime(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                <label
                  htmlFor="timer-travel"
                  className="text-sm text-muted-foreground"
                >
                  Travel Time
                  <span className="ml-1 text-xs opacity-60">(next invoice)</span>
                </label>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-200">
                  {success}
                </div>
              )}

              {isRunning && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Pill */}
      <motion.div
        layout
        className="flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 shadow-lg"
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? "Collapse timer" : "Expand timer"}
        >
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Timer display */}
        <span className="font-mono text-sm font-bold tabular-nums">
          {formatDuration(elapsed)}
        </span>

        {/* Client name */}
        {selectedClient && isRunning && (
          <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:inline">
            {selectedClient.companyName}
          </span>
        )}

        {/* Play/Stop button */}
        {!isRunning ? (
          <button
            type="button"
            onClick={() => {
              if (!selectedClientId || !selectedRetainerId) {
                setIsExpanded(true)
                setError("Select a client and retainer first")
              } else {
                handleStart()
              }
            }}
            disabled={isSaving}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-label="Start timer"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            disabled={isSaving}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            aria-label="Stop timer"
          >
            {isSaving ? (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            )}
          </button>
        )}
      </motion.div>
    </div>
  )
}
