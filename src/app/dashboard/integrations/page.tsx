"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type IntegrationConnection = {
  id: string
  provider: "QBO" | "XERO" | "ODOO" | "STRIPE"
  status: "ACTIVE" | "INACTIVE" | "ERROR"
  lastSyncAt: string | null
  createdAt: string
  tokenExpiry: string | null
}

const INTEGRATION_META: Record<
  string,
  { label: string; description: string; connectProvider: string | null }
> = {
  QBO: {
    label: "QuickBooks Online",
    description: "Sync clients and push invoices to QuickBooks Online.",
    connectProvider: "qbo",
  },
  XERO: {
    label: "Xero",
    description: "Sync clients and push invoices to Xero.",
    connectProvider: "xero",
  },
  ODOO: {
    label: "Odoo",
    description: "Enterprise accounting sync via Odoo.",
    connectProvider: null, // OAuth not yet implemented for Odoo
  },
  STRIPE: {
    label: "Stripe",
    description: "Process payments and manage invoices via Stripe.",
    connectProvider: null, // Managed via Stripe dashboard / env vars
  },
}

const ALL_PROVIDERS = ["QBO", "XERO", "ODOO", "STRIPE"] as const

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<IntegrationConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flashMessage, setFlashMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    // Pick up ?success= or ?error= from OAuth callback redirects
    const params = new URLSearchParams(window.location.search)
    const success = params.get("success")
    const err = params.get("error")
    if (success) setFlashMessage({ type: "success", text: decodeURIComponent(success) })
    if (err) setFlashMessage({ type: "error", text: decodeURIComponent(err) })

    // Remove query params from URL without triggering reload
    if (success || err) {
      const clean = window.location.pathname
      window.history.replaceState({}, "", clean)
    }

    fetchConnections()
  }, [])

  async function fetchConnections() {
    try {
      setLoading(true)
      const res = await fetch("/api/integrations")
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403) {
          setError("Only admins can manage integrations.")
          return
        }
        throw new Error(data.error || "Failed to load integrations")
      }
      const data = await res.json()
      setConnections(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Disconnect this integration? Synced data will remain, but future syncing will stop.")) return
    setDisconnecting(id)
    try {
      const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Disconnect failed")
      setFlashMessage({ type: "success", text: "Integration disconnected." })
      await fetchConnections()
    } catch (err: any) {
      setFlashMessage({ type: "error", text: err.message })
    } finally {
      setDisconnecting(null)
    }
  }

  function getConnection(provider: string) {
    return connections.find((c) => c.provider === provider) ?? null
  }

  function statusBadge(status: IntegrationConnection["status"]) {
    if (status === "ACTIVE") return <Badge variant="default">Connected</Badge>
    if (status === "ERROR") return <Badge variant="destructive">Error</Badge>
    return <Badge variant="secondary">Inactive</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect accounting software and payment processors
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {flashMessage && (
        <div
          className={`rounded-lg border p-4 ${
            flashMessage.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {flashMessage.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ALL_PROVIDERS.map((provider) => {
          const meta = INTEGRATION_META[provider]
          const conn = getConnection(provider)

          return (
            <Card key={provider}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg">{meta.label}</CardTitle>
                  <CardDescription className="mt-1">{meta.description}</CardDescription>
                </div>
                {conn ? statusBadge(conn.status) : <Badge variant="outline">Not connected</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                {conn && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Connected:{" "}
                      {new Date(conn.createdAt).toLocaleDateString()}
                    </p>
                    {conn.lastSyncAt && (
                      <p>
                        Last sync:{" "}
                        {new Date(conn.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    {conn.tokenExpiry && new Date(conn.tokenExpiry) < new Date() && (
                      <p className="text-destructive">Access token expired — reconnect to resume syncing.</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {conn ? (
                    <>
                      {meta.connectProvider && (
                        <a href={`/api/integrations/connect?provider=${meta.connectProvider}`}>
                          <Button variant="outline" size="sm">
                            Reconnect
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={disconnecting === conn.id}
                      >
                        {disconnecting === conn.id ? "Disconnecting…" : "Disconnect"}
                      </Button>
                    </>
                  ) : meta.connectProvider ? (
                    <a href={`/api/integrations/connect?provider=${meta.connectProvider}`}>
                      <Button size="sm">Connect</Button>
                    </a>
                  ) : (
                    <Button size="sm" disabled>
                      Configure via environment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium">Setup Notes</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>QuickBooks Online:</strong> Set{" "}
            <code className="rounded bg-muted px-1 text-xs">QBO_CLIENT_ID</code>,{" "}
            <code className="rounded bg-muted px-1 text-xs">QBO_CLIENT_SECRET</code>, and{" "}
            <code className="rounded bg-muted px-1 text-xs">QBO_REDIRECT_URI</code> in your environment.
          </li>
          <li>
            <strong>Xero:</strong> Set{" "}
            <code className="rounded bg-muted px-1 text-xs">XERO_CLIENT_ID</code>,{" "}
            <code className="rounded bg-muted px-1 text-xs">XERO_CLIENT_SECRET</code>, and{" "}
            <code className="rounded bg-muted px-1 text-xs">XERO_REDIRECT_URI</code>.
          </li>
          <li>
            <strong>Stripe:</strong> Configured via{" "}
            <code className="rounded bg-muted px-1 text-xs">STRIPE_SECRET_KEY</code> and{" "}
            <code className="rounded bg-muted px-1 text-xs">STRIPE_WEBHOOK_SECRET</code>. Use the Stripe
            Dashboard to manage webhook endpoints.
          </li>
        </ul>
      </div>
    </div>
  )
}
