import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { contactFullName } from "@/types/contact"
import { leadFullName } from "@/types/lead"

export type RelatedRecordType = "lead" | "contact" | "deal"

export interface RelatedRecordValue {
  type: RelatedRecordType
  id: string
  label: string
}

interface SearchResult {
  id: string
  label: string
  sublabel?: string
}

const TYPE_OPTIONS: { value: RelatedRecordType; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contact", label: "Contact" },
  { value: "deal", label: "Deal" },
]

interface RelatedRecordPickerProps {
  value: RelatedRecordValue | null
  onChange: (value: RelatedRecordValue | null) => void
}

export function RelatedRecordPicker({ value, onChange }: RelatedRecordPickerProps) {
  const supabase = useSupabaseClient()
  const [type, setType] = useState<RelatedRecordType | "">(value?.type ?? "")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const { data: results, isFetching } = useQuery({
    queryKey: ["related-record-search", type, query],
    enabled: open && Boolean(type),
    queryFn: async (): Promise<SearchResult[]> => {
      const term = query.trim().replace(/[,()%]/g, " ")
      const pattern = `%${term}%`

      if (type === "lead") {
        let q = supabase
          .from("leads")
          .select("id, first_name, last_name, email")
          .order("created_at", { ascending: false })
          .limit(20)
        if (term) q = q.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
        const { data, error } = await q
        if (error) throw error
        return (data ?? []).map((lead) => ({
          id: lead.id,
          label: leadFullName(lead),
          sublabel: lead.email ?? undefined,
        }))
      }

      if (type === "contact") {
        let q = supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .order("created_at", { ascending: false })
          .limit(20)
        if (term) q = q.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
        const { data, error } = await q
        if (error) throw error
        return (data ?? []).map((contact) => ({
          id: contact.id,
          label: contactFullName(contact),
          sublabel: contact.email ?? undefined,
        }))
      }

      if (type === "deal") {
        let q = supabase
          .from("deals")
          .select("id, title")
          .order("created_at", { ascending: false })
          .limit(20)
        if (term) q = q.ilike("title", pattern)
        const { data, error } = await q
        if (error) throw error
        return (data ?? []).map((deal) => ({ id: deal.id, label: deal.title }))
      }

      return []
    },
  })

  function handleTypeChange(nextType: string) {
    if (nextType === "none") {
      setType("")
      onChange(null)
      return
    }
    setType(nextType as RelatedRecordType)
    onChange(null)
    setQuery("")
  }

  return (
    <div className="space-y-2">
      <Select value={type || "none"} onValueChange={handleTypeChange}>
        <SelectTrigger>
          <SelectValue placeholder="No related record" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No related record</SelectItem>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {type && (
        <div className="relative">
          {value && !open ? (
            <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
              <span className="text-slate-800">{value.label}</span>
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
                  aria-label="Clear selected record"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={`Search ${type}s…`}
              />
              {open && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
                  {isFetching ? (
                    <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>
                  ) : results && results.length > 0 ? (
                    results.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onChange({ type: type as RelatedRecordType, id: result.id, label: result.label })
                          setQuery("")
                          setOpen(false)
                        }}
                        className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm text-slate-800">{result.label}</span>
                        {result.sublabel && (
                          <span className="text-xs text-slate-400">{result.sublabel}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-400">No results found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
