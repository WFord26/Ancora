"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface Retainer {
  id: string
  name: string
  clientId: string
}

interface Period {
  id: string
  periodStart: string
  periodEnd: string
  status: string
  usedHours: number
  includedHours: number
}

interface TimesheetExportButtonProps {
  retainers: Retainer[]
}

export default function TimesheetExportButton({ retainers }: TimesheetExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedRetainerId, setSelectedRetainerId] = useState("")
  const [selectedPeriodId, setSelectedPeriodId] = useState("")
  const [selectedFormat, setSelectedFormat] = useState("csv")
  const [periods, setPeriods] = useState<Period[]>([])
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick)
    }
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  // Fetch periods when retainer changes
  useEffect(() => {
    if (!selectedRetainerId) {
      setPeriods([])
      setSelectedPeriodId("")
      return
    }
    setLoadingPeriods(true)
    setSelectedPeriodId("")
    fetch(`/api/retainer-periods?retainerId=${selectedRetainerId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setPeriods(data.data)
          if (data.data.length > 0) {
            setSelectedPeriodId(data.data[0].id)
          }
        }
        setLoadingPeriods(false)
      })
      .catch(() => {
        setPeriods([])
        setLoadingPeriods(false)
      })
  }, [selectedRetainerId])

  const handleExport = async () => {
    if (!selectedPeriodId) {
      setError("Select a period to export")
      return
    }
    setError("")
    setIsExporting(true)

    try {
      const response = await fetch("/api/timesheet/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retainerPeriodId: selectedPeriodId,
          format: selectedFormat,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Export failed")
      }

      // Trigger download
      const blob = await response.blob()
      const contentDisposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `timesheet.${selectedFormat}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  function formatPeriodLabel(period: Period): string {
    try {
      const start = format(new Date(period.periodStart), "MMM d")
      const end = format(new Date(period.periodEnd), "MMM d, yyyy")
      const used = Number(period.usedHours).toFixed(1)
      const included = Number(period.includedHours).toFixed(0)
      return `${start} – ${end}  (${used}/${included} hrs)  [${period.status}]`
    } catch {
      return period.id
    }
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Export timesheet"
      >
        Export Timesheet
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card p-4 shadow-xl">
          <p className="mb-3 text-sm font-semibold">Export Timesheet</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Retainer
              </label>
              <select
                className={selectClass}
                value={selectedRetainerId}
                onChange={(e) => setSelectedRetainerId(e.target.value)}
              >
                <option value="">Select retainer…</option>
                {retainers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Period
              </label>
              <select
                className={selectClass}
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                disabled={!selectedRetainerId || loadingPeriods}
              >
                {loadingPeriods ? (
                  <option>Loading…</option>
                ) : periods.length === 0 ? (
                  <option value="">
                    {selectedRetainerId ? "No periods found" : "Select retainer first"}
                  </option>
                ) : (
                  periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPeriodLabel(p)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Format
              </label>
              <select
                className={selectClass}
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
              >
                <option value="csv">CSV (Spreadsheet)</option>
                <option value="excel">Excel (.xls)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <Button
              className="w-full"
              size="sm"
              disabled={!selectedPeriodId || isExporting}
              onClick={handleExport}
            >
              {isExporting ? "Exporting…" : "Download Timesheet"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
