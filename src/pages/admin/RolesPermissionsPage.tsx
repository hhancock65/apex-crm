import { Check, Info, Minus, Pencil } from "lucide-react"

import { PermissionGate } from "@/components/permissions/PermissionGate"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FEATURE_LABELS, FEATURES, PERMISSION_MATRIX, type AccessLevel } from "@/lib/permissions"
import { ORG_ROLES, ORG_ROLE_LABELS } from "@/types/profile"

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full access, can manage billing, team, and settings, and can delete the organization.",
  admin: "Full access except billing and organization deletion.",
  manager: "Can view all records, manage team assignments, and view analytics.",
  sales_rep: "Can manage their own leads, contacts, deals, and tasks. Cannot see others' data or access admin.",
  viewer: "Read-only access to dashboards and reports.",
}

function AccessIcon({ level }: { level: AccessLevel }) {
  if (level === "edit") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Pencil className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Edit</span>
      </span>
    )
  }
  if (level === "view") {
    return (
      <span className="inline-flex items-center gap-1 text-apex-teal">
        <Check className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">View</span>
      </span>
    )
  }
  return <Minus className="h-3.5 w-3.5 text-slate-300" />
}

function RolesPermissionsPageContent() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Roles &amp; Permissions</h1>
        <p className="mt-1 text-sm text-slate-500">Control who can see and do what.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ORG_ROLES.map((role) => (
          <div key={role} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">{ORG_ROLE_LABELS[role]}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              {ORG_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {ORG_ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {FEATURES.map((feature) => (
              <TableRow key={feature}>
                <TableCell className="font-medium text-slate-800">{FEATURE_LABELS[feature]}</TableCell>
                {ORG_ROLES.map((role) => (
                  <TableCell key={role} className="text-center">
                    <div className="flex justify-center">
                      <AccessIcon level={PERMISSION_MATRIX[role][feature]} />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-500">Custom roles coming soon — for now, roles and their permissions are fixed.</p>
      </div>
    </div>
  )
}

export default function RolesPermissionsPage() {
  return (
    <PermissionGate requiredRole={["owner", "admin"]}>
      <RolesPermissionsPageContent />
    </PermissionGate>
  )
}
