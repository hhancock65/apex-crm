import { UploadCloud } from "lucide-react"

export function KnowledgePlaceholder() {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <UploadCloud className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-medium text-slate-500">
        Drag files here or click to browse
      </p>
      <p className="mt-1 text-xs text-slate-400">
        PDF, DOCX, or TXT — knowledge base uploads and retrieval are coming soon.
      </p>
    </div>
  )
}
