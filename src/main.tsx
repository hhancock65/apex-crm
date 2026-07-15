import { ClerkProvider } from "@clerk/clerk-react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App.tsx"
import { Toaster } from "@/components/ui/sonner"
import "./index.css"

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Check your .env file."
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/sign-in">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
)
