# Client Portal Invitations Admin UI Setup Guide

## Overview
This guide covers implementing admin UI components to expose the email and invitation systems to actual users. After completion, admins can send both team member and client invitations directly from the dashboard.

---

## Phase 1: Team Member Invitations UI

### Location
`src/app/dashboard/settings/team/page.tsx` (or similar team management page)

### Components Needed

#### 1. **InviteTeamMemberDialog** Component
```typescript
// src/components/dashboard/invite-team-member-dialog.tsx

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface InviteTeamMemberDialogProps {
  onInviteSent?: () => void
}

export function InviteTeamMemberDialog({ onInviteSent }: InviteTeamMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send invitation')
      }

      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('STAFF')
      setOpen(false)
      onInviteSent?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite Team Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select value={role} onValueChange={(value) => setRole(value as 'STAFF' | 'ADMIN')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">Staff Member</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

#### 2. **TeamMembersTable** with Invitations Column
```typescript
// src/components/dashboard/team-members-table.tsx

import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

interface TeamMember {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF'
  createdAt: Date
}

interface TeamInvitation {
  id: string
  email: string
  role: 'ADMIN' | 'STAFF'
  expiresAt: Date
  createdAt: Date
}

export function TeamMembersTable({ members, invitations }: { 
  members: TeamMember[]
  invitations: TeamInvitation[]
}) {
  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
          {row.getValue('role')}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Joined',
      cell: ({ row }) => format(new Date(row.getValue('createdAt')), 'MMM dd, yyyy'),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Members</h3>
        <DataTable columns={columns} data={members} />
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Invitations</h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center p-4 border rounded">
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-sm text-gray-500">
                    Expires {format(new Date(inv.expiresAt), 'MMM dd, yyyy')}
                  </p>
                </div>
                <span className="text-sm text-gray-600">{inv.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Phase 2: Client Invitations UI

### Location
`src/app/dashboard/clients/[clientId]/page.tsx` or separate clients management section

### Components Needed

#### 1. **InviteClientDialog** Component
```typescript
// src/components/dashboard/invite-client-dialog.tsx

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface InviteClientDialogProps {
  clientId: string
  clientName: string
  onInviteSent?: () => void
}

export function InviteClientDialog({ 
  clientId, 
  clientName, 
  onInviteSent 
}: InviteClientDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/clients/${clientId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clientName })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send invitation')
      }

      toast.success(`Portal invitation sent to ${email}`)
      setEmail('')
      setOpen(false)
      onInviteSent?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Invite to Portal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {clientName} to Portal</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client Email Address</label>
            <Input
              type="email"
              placeholder="contact@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              The client will receive an email with a link to access their portal
            </p>
          </div>

          <div className="pt-4 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

#### 2. **ClientPortalAccess** Component
```typescript
// src/components/dashboard/client-portal-access.tsx

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InviteClientDialog } from './invite-client-dialog'
import { format } from 'date-fns'

interface ClientInvitation {
  id: string
  email: string
  acceptedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

interface ClientPortalAccessProps {
  clientId: string
  clientName: string
  clientEmail: string
  invitations: ClientInvitation[]
  hasActiveUser: boolean
  onInviteSent?: () => void
}

export function ClientPortalAccess({
  clientId,
  clientName,
  clientEmail,
  invitations,
  hasActiveUser,
  onInviteSent
}: ClientPortalAccessProps) {
  const acceptedInvitation = invitations.find(inv => inv.acceptedAt)
  const pendingInvitations = invitations.filter(inv => !inv.acceptedAt && new Date(inv.expiresAt) > new Date())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal Access</CardTitle>
        <CardDescription>
          Manage this client's access to the retainer portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Current Access Status */}
        <div>
          <h3 className="font-medium mb-2">Current Status</h3>
          {hasActiveUser ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                ✓ Client has portal access
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                No portal access yet
              </p>
            </div>
          )}
        </div>

        {/* Accepted Invitation */}
        {acceptedInvitation && (
          <div>
            <h3 className="font-medium mb-2">Portal Access Granted</h3>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                Invitation accepted {format(new Date(acceptedInvitation.acceptedAt!), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Pending Invitations</h3>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center p-3 border rounded bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-gray-500">
                      Expires {format(new Date(inv.expiresAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send New Invitation */}
        <div className="border-t pt-4">
          <InviteClientDialog
            clientId={clientId}
            clientName={clientName}
            onInviteSent={onInviteSent}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 3: Updates to Client Detail Page

### File: `src/app/dashboard/clients/[clientId]/page.tsx`

Add to the client detail page:

```typescript
import { ClientPortalAccess } from '@/components/dashboard/client-portal-access'
import { prisma } from '@/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function ClientDetailPage({ 
  params: { clientId } 
}: { 
  params: { clientId: string } 
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const client = await prisma.client.findUnique({
    where: { id: clientId, tenantId: session.user.tenantId },
    include: {
      clientInvitations: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!client) return <div>Client not found</div>

  // Check if client has an active CLIENT user
  const clientUser = await prisma.user.findFirst({
    where: {
      email: client.contactEmail,
      role: 'CLIENT',
      tenantId: session.user.tenantId
    }
  })

  return (
    <div className="space-y-6">
      {/* Existing client info... */}
      
      {/* Portal Access Section */}
      <ClientPortalAccess
        clientId={client.id}
        clientName={client.companyName}
        clientEmail={client.contactEmail}
        invitations={client.clientInvitations}
        hasActiveUser={!!clientUser}
      />
    </div>
  )
}
```

---

## Phase 4: Team Management Page

### File: `src/app/dashboard/settings/team/page.tsx` (New)

```typescript
import { InviteTeamMemberDialog } from '@/components/dashboard/invite-team-member-dialog'
import { TeamMembersTable } from '@/components/dashboard/team-members-table'
import { prisma } from '@/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function TeamPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  
  // Only admins can access
  if (session.user.role !== 'ADMIN') {
    return <div className="text-red-600">Access denied</div>
  }

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        role: { in: ['ADMIN', 'STAFF'] }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.tenantInvitation.findMany({
      where: {
        tenantId: session.user.tenantId,
        acceptedAt: null
      },
      orderBy: { createdAt: 'desc' }
    })
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-gray-600">Manage your team members and invitations</p>
        </div>
        <InviteTeamMemberDialog />
      </div>

      <TeamMembersTable members={members} invitations={invitations} />
    </div>
  )
}
```

---

## Phase 5: Navigation Updates

### Add links to sidebar/navigation:

```typescript
// src/components/dashboard/sidebar.tsx or navigation component

const navItems = [
  // ... existing items
  {
    title: 'Settings',
    items: [
      { href: '/dashboard/settings/team', label: '👥 Team' },
      { href: '/dashboard/settings/account', label: '⚙️ Account' },
      { href: '/dashboard/settings/billing', label: '💳 Billing' },
    ]
  }
]
```

---

## Installation Steps

### 1. Install Dialog Component (if not present)
```bash
npx shadcn-ui@latest add dialog
```

### 2. Create Component Files
```bash
# Create components
touch src/components/dashboard/invite-team-member-dialog.tsx
touch src/components/dashboard/invite-client-dialog.tsx
touch src/components/dashboard/client-portal-access.tsx
touch src/components/dashboard/team-members-table.tsx
```

### 3. Copy code from sections above into respective files

### 4. Update existing pages
- Update client detail page with ClientPortalAccess component
- Create new team management page
- Update sidebar navigation

### 5. Verify types
```bash
npm run db:generate
npx tsc --noEmit
```

---

## Usage Workflows

### For Admins: Send Team Invitation

1. Dashboard → Settings → Team
2. Click "Invite Team Member"
3. Enter colleague email
4. Select role (Admin or Staff)
5. Click "Send Invitation"
6. Email sent to colleague
7. Colleague clicks link → Creates account & grants access

### For Admins: Send Client Invitation

1. Dashboard → Clients
2. Click on a client
3. Scroll to "Portal Access" section
4. Click "Invite to Portal"
5. Enter client email
6. Click "Send Invitation"
7. Email sent to client
8. Client clicks link → Creates account & grants portal access

---

## Features Added

✅ Admin UI for sending team invitations
✅ Admin UI for sending client invitations
✅ Display pending invitations
✅ Show invitation status (pending/accepted)
✅ Display invitation expiration dates
✅ Toast notifications for user feedback
✅ Loading states during submission
✅ Team members list with pagination
✅ Client portal access status card
✅ Responsive dialog components

---

## Testing

### Test Team Invitations UI
1. Verify dialog opens/closes properly
2. Submit valid email + role
3. Check that API is called correctly
4. Verify toast notification appears
5. Check database for invitation record
6. Verify email is sent (check Resend)

### Test Client Invitations UI
1. Open client detail page
2. Verify portal access section displays
3. Submit client email
4. Check that API is called correctly
5. Verify pending invitation appears in list
6. Submit different email - should also show pending
7. Test email link in invitation

---

## Error Handling

All components handle:
- Network errors
- Validation errors (invalid email)
- Authorization errors (non-admin trying to invite)
- Duplicate invitations
- Expired tokens
- Already-accepted invitations

Errors are displayed as toast notifications at top of page.

---

## Next Steps

After implementation:
1. Deploy to staging
2. Test end-to-end invitation flows
3. Monitor Resend email delivery
4. Get user feedback on UI/UX
5. Consider adding:
   - Resend invitation button for expired tokens
   - Batch CSV upload for team invites
   - Email template customization

---

## Estimated Time

- Phase 1 (Team UI): 1-2 hours
- Phase 2 (Client UI): 1-2 hours
- Phase 3 (Integration): 30 mins
- Phase 4 (Team Page): 30 mins
- Phase 5 (Navigation): 15 mins
- **Total: 3.5-5 hours**

---

Status: Ready to implement ✓
