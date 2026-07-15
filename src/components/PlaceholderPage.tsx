interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
      <div className="mt-6 flex h-[60vh] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
        <p className="text-sm text-slate-400">{title} — coming soon</p>
      </div>
    </div>
  )
}
