"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, ArrowRight, Trash2 } from "lucide-react"
import OnboardingLayout from "@/components/onboarding/onboarding-layout"

interface TeamMember {
  email: string
  role: "ADMIN" | "STAFF"
}

export default function TeamSetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"STAFF">("STAFF")
  const [skipTeam, setSkipTeam] = useState(false)

  function addTeamMember() {
    if (!newEmail) {
      setError("Please enter an email")
      return
    }

    if (teamMembers.some((m) => m.email === newEmail)) {
      setError("This email is already in the list")
      return
    }

    setTeamMembers([...teamMembers, { email: newEmail, role: newRole }])
    setNewEmail("")
    setError("")
  }

  function removeTeamMember(email: string) {
    setTeamMembers(teamMembers.filter((m) => m.email !== email))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (!skipTeam && teamMembers.length > 0) {
        // Send invitations for all team members
        for (const member of teamMembers) {
          const response = await fetch("/api/invitations/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: member.email,
              role: member.role,
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(`Failed to invite ${member.email}: ${data.message}`)
          }
        }
      }

      // Go to completion
      router.push("/dashboard/onboarding/complete")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={4} totalSteps={5}>
      <CardHeader>
        <CardTitle>Invite Your Team</CardTitle>
        <CardDescription>
          Optional: Invite team members to collaborate. You can do this later too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!skipTeam ? (
            <div className="space-y-4">
              {/* Add team member form */}
              <div className="space-y-3 p-4 bg-slate-700/50 rounded-lg">
                <h3 className="font-medium text-sm">Add Team Members</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role" className="text-xs">Role</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as "STAFF")}>
                      <SelectTrigger id="role" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff Member</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTeamMember}
                  disabled={isLoading || !newEmail}
                  className="w-full md:w-auto"
                >
                  Add to List
                </Button>
              </div>

              {/* Team members list */}
              {teamMembers.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Team Members to Invite ({teamMembers.length})</h3>
                  {teamMembers.map((member) => (
                    <div
                      key={member.email}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.email}</p>
                        <p className="text-xs text-slate-400">{member.role}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTeamMember(member.email)}
                        disabled={isLoading}
                        className="ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center bg-slate-700/30 rounded-lg">
                  <p className="text-sm text-slate-400">No team members added yet</p>
                </div>
              )}

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm text-blue-200">
                  <strong>💡 Info:</strong> Team members will receive invitation emails with links to sign up.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="text-5xl">👥</div>
              <div>
                <p className="font-medium">Skip team invites</p>
                <p className="text-sm text-slate-400">You can invite team members later from settings</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-between flex-wrap">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSkipTeam(!skipTeam)}
              disabled={isLoading}
            >
              {skipTeam ? "Add team members" : "Skip this step"}
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </OnboardingLayout>
  )
}
