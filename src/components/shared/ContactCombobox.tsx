import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { contactFullName, type ContactSummary } from "@/types/contact"

interface ContactComboboxProps {
  value: ContactSummary | null
  onChange: (contact: ContactSummary | null) => void
}

export function ContactCombobox({ value, onChange }: ContactComboboxProps) {
  const supabase = useSupabaseClient()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const { data: results, isFetching } = useQuery({
    queryKey: ["contacts-search", query],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .order("created_at", { ascending: false })
        .limit(20)

      const term = query.trim().replace(/[,()%]/g, " ")
      if (term) {
        const pattern = `%${term}%`
        q = q.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as ContactSummary[]
    },
  })

  if (value && !open) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
        <span className="text-slate-800">{contactFullName(value)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-apex-teal hover:underline"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear selected contact"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search contacts by name or email…"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {isFetching ? (
            <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>
          ) : results && results.length > 0 ? (
            results.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(contact)
                  setQuery("")
                  setOpen(false)
                }}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="text-sm text-slate-800">{contactFullName(contact)}</span>
                {contact.email && <span className="text-xs text-slate-400">{contact.email}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">No contacts found</div>
          )}
        </div>
      )}
    </div>
  )
}
