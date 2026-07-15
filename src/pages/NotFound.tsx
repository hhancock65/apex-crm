import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-apex-surface px-4 text-center">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-slate-500">This page doesn't exist.</p>
      <Button asChild>
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
