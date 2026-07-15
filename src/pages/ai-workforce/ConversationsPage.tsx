import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { ConversationChannelBadge } from "@/components/ai-workforce/ConversationChannelBadge"
import { ConversationStatusBadge } from "@/components/ai-workforce/ConversationStatusBadge"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { DEFAULT_CONVERSATION_FILTERS, useConversations } from "@/hooks/useConversations"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
  formatConversationDuration,
  lastMessagePreview,
  type ConversationChannel,
  type ConversationStatus,
} from "@/types/conversation"

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  phone: "Phone",
  sms: "SMS",
  email: "Email",
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  active: "Active",
  completed: "Completed",
  escalated: "Escalated",
}

export default function ConversationsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_CONVERSATION_FILTERS)

  const { data, isLoading, isFetching, error } = useConversations(filters)
  const { data: employees } = useAiEmployees()

  const conversations = data?.conversations ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conversations</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLoading ? "Loading…" : `${total} conversation${total === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select value={filters.aiEmployeeId} onValueChange={(v) => updateFilter("aiEmployeeId", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="AI Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.channel}
          onValueChange={(v) => updateFilter("channel", v as ConversationChannel | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {CONVERSATION_CHANNELS.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {CHANNEL_LABELS[channel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => updateFilter("status", v as ConversationStatus | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CONVERSATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>AI Employee</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration / Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-400">
                  Loading conversations…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-destructive">
                  Failed to load conversations: {error instanceof Error ? error.message : "Unknown error"}
                </TableCell>
              </TableRow>
            ) : conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-400">
                  No conversations match your filters.
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conversation) => {
                const duration = formatConversationDuration(
                  conversation.channel,
                  conversation.started_at,
                  conversation.ended_at
                )
                return (
                  <TableRow
                    key={conversation.id}
                    className={cn("cursor-pointer", isFetching && "opacity-60")}
                    onClick={() => navigate(`/conversations/${conversation.id}`)}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {conversation.contact ? contactFullName(conversation.contact) : "Unknown"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {conversation.ai_employee?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ConversationChannelBadge channel={conversation.channel} />
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-slate-500">
                      {lastMessagePreview(conversation.messages)}
                    </TableCell>
                    <TableCell>
                      <ConversationStatusBadge status={conversation.status} />
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {duration ?? formatDateTime(conversation.started_at)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}
    </div>
  )
}
