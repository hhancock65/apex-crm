import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const pages = getPageWindow(page, pageCount)

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-slate-400">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function getPageWindow(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1])
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)

  const result: (number | "ellipsis")[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis")
    }
    result.push(sorted[i])
  }
  return result
}
