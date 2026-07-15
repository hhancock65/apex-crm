import { useUser } from "@clerk/clerk-react"
import { MoreHorizontal, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGate } from "@/components/permissions/PermissionGate"
import { usePermissions } from "@/hooks/usePermissions"
import {
  useInviteTeamMember,
  useRemoveTeamMember,
  useRevokeInvitation,
  useTeamManagement,
  useUpdateTeamMemberRole,
  type PendingInvitation,
  type TeamMember,
} from "@/hooks/useTeamManagement"
import { ORG_ROLES, ORG_ROLE_LABELS, type OrgRole } from "@/types/profile"

function memberName(member: TeamMember): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ")
  return name || member.email || "Unnamed"
}

function formatLastActive(timestampMs: number | null): string {
  if (!timestampMs) return "—"
  return new Date(timestampMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("sales_rep")
  const invite = useInviteTeamMember()

  function handleSubmit() {
    if (!email.trim()) return
    invite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${email.trim()}`)
          setEmail("")
          setRole("sales_rep")
          onOpenChange(false)
        },
        onError: (error) => toast.error("Failed to send invitation", { description: error.message }),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_ROLES.filter((r) => r !== "owner").map((r) => (
                  <SelectItem key={r} value={r}>
                    {ORG_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!email.trim() || invite.isPending}>
            {invite.isPending ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const { isOwner } = usePermissions()
  const updateRole = useUpdateTeamMemberRole()
  const removeMember = useRemoveTeamMember()
  const [confirmRemove, setConfirmRemove] = useState(false)

  const assignableRoles = ORG_ROLES.filter((r) => r !== "owner" || isOwner)
  const canChangeRole = member.status === "active" && member.profileId && !isSelf
  const canRemove = member.status === "active" && member.profileId && !isSelf

  function handleRoleChange(newRole: OrgRole) {
    if (!member.profileId) return
    updateRole.mutate(
      { profileId: member.profileId, role: newRole },
      { onError: (error) => toast.error("Failed to change role", { description: error.message }) }
    )
  }

  function handleRemove() {
    if (!member.profileId) return
    removeMember.mutate(
      { profileId: member.profileId },
      {
        onSuccess: () => toast.success(`${memberName(member)} removed from the team`),
        onError: (error) => toast.error("Failed to remove team member", { description: error.message }),
      }
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">
        {memberName(member)}
        {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
      </TableCell>
      <TableCell className="text-slate-500">{member.email ?? "—"}</TableCell>
      <TableCell>
        {canChangeRole ? (
          <Select value={member.role ?? undefined} onValueChange={(v) => handleRoleChange(v as OrgRole)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ORG_ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {member.role ? ORG_ROLE_LABELS[member.role] : "—"}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            member.status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }
        >
          {member.status === "active" ? "Active" : "Invited"}
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500">{formatLastActive(member.lastActiveAt)}</TableCell>
      <TableCell className="text-right">
        {canRemove && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600" onSelect={() => setConfirmRemove(true)}>
                  Remove from team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {memberName(member)}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They'll immediately lose access to this organization. This can't be undone from here — they'd need
                    a new invitation to rejoin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleRemove}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </TableCell>
    </TableRow>
  )
}

function PendingInvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const revoke = useRevokeInvitation()

  function handleRevoke() {
    revoke.mutate(
      { invitationId: invitation.id },
      {
        onSuccess: () => toast.success(`Invitation to ${invitation.email} revoked`),
        onError: (error) => toast.error("Failed to revoke invitation", { description: error.message }),
      }
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
          {ORG_ROLE_LABELS[invitation.role]}
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500">{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={handleRevoke} disabled={revoke.isPending}>
          Revoke
        </Button>
      </TableCell>
    </TableRow>
  )
}

function TeamPageContent() {
  const { data, isLoading } = useTeamManagement()
  const { user } = useUser()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the humans on your team.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data?.members || data.members.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No team members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((member) => (
                <MemberRow key={member.clerkUserId} member={member} isSelf={member.clerkUserId === user?.id} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data?.pendingInvitations && data.pendingInvitations.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <h2 className="p-5 pb-0 text-sm font-semibold text-slate-800">Pending Invitations</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pendingInvitations.map((invitation) => (
                <PendingInvitationRow key={invitation.id} invitation={invitation} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}

export default function TeamPage() {
  return (
    <PermissionGate requiredRole={["owner", "admin"]}>
      <TeamPageContent />
    </PermissionGate>
  )
}
