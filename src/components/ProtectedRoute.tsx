import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react"
import { Outlet } from "react-router-dom"

export default function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
