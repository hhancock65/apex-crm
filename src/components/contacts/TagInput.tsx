import { X } from "lucide-react"
import { type KeyboardEvent, useMemo, useState } from "react"

import { TagBadge } from "@/components/contacts/TagBadge"
import { cn } from "@/lib/utils"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

export function TagInput({ value, onChange, suggestions = [], placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const matchingSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    return suggestions
      .filter((tag) => !value.some((v) => v.toLowerCase() === tag.toLowerCase()))
      .filter((tag) => !query || tag.toLowerCase().includes(query))
      .slice(0, 8)
  }, [suggestions, value, inputValue])

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue("")
      return
    }
    onChange([...value, trimmed])
    setInputValue("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {value.map((tag) => (
          <TagBadge key={tag} tag={tag} className="gap-1 pr-1">
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-black/10"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </TagBadge>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? placeholder ?? "Add tags…" : undefined}
          className="min-w-[100px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showSuggestions && matchingSuggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {matchingSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(tag)}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
