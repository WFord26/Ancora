"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type User = {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "STAFF" | "CLIENT"
  timezone: string | null
  isActive: boolean
  createdAt: string
}

type FormMode = "create" | "edit" | null

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "STAFF" as "ADMIN" | "STAFF" | "CLIENT",
    timezone: "",
    password: "",
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch("/api/users?limit=100")
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403) {
          setError("You do not have permission to manage users.")
          return
        }
        throw new Error(data.error || "Failed to fetch users")
      }
      const data = await res.json()
      setUsers(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreateForm() {
    setSelectedUser(null)
    setFormData({ name: "", email: "", role: "STAFF", timezone: "", password: "" })
    setFormError(null)
    setFormMode("create")
  }

  function openEditForm(user: User) {
    setSelectedUser(user)
    setFormData({ name: user.name ?? "", email: user.email, role: user.role, timezone: user.timezone ?? "", password: "" })
    setFormError(null)
    setFormMode("edit")
  }

  function closeForm() {
    setFormMode(null)
    setSelectedUser(null)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        timezone: formData.timezone || undefined,
      }

      let res: Response
      if (formMode === "create") {
        payload.password = formData.password
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        if (formData.password) payload.password = formData.password
        res = await fetch(`/api/users/${selectedUser!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Operation failed")
      }

      await fetchUsers()
      closeForm()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user: User) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      await fetchUsers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const roleBadgeVariant = (role: string) => {
    if (role === "ADMIN") return "default" as const
    if (role === "CLIENT") return "secondary" as const
    return "outline" as const
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">
            Manage team members and their access roles
          </p>
        </div>
        <Button onClick={openCreateForm}>+ Invite User</Button>
      </div>

      {/* User Form Panel */}
      {formMode && (
        <Card>
          <CardHeader>
            <CardTitle>{formMode === "create" ? "Invite New User" : "Edit User"}</CardTitle>
            <CardDescription>
              {formMode === "create"
                ? "Create a new team member account with a temporary password."
                : "Update this user's name, role, or password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                    required
                    disabled={formMode === "edit"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    aria-label="Role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        role: e.target.value as "ADMIN" | "STAFF" | "CLIENT",
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="STAFF">Staff</option>
                    <option value="CLIENT">Client</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData((f) => ({ ...f, timezone: e.target.value }))}
                    placeholder="America/New_York"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password">
                    {formMode === "create" ? "Password" : "New Password (leave blank to keep current)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                    placeholder={formMode === "create" ? "Min. 8 characters" : "Leave blank to keep current"}
                    required={formMode === "create"}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : formMode === "create"
                    ? "Create User"
                    : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">
                    {user.name || <span className="text-muted-foreground italic">No name</span>}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.timezone || "—"}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditForm(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(user)}
                        className={user.isActive ? "text-destructive hover:text-destructive" : ""}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
