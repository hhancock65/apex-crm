import { SignIn } from "@clerk/clerk-react"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-apex-navy px-4">
      <div className="mb-8 flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            APEX<span className="text-apex-teal">-CRM</span>
          </h1>
          <p className="mt-1 text-sm text-white/60">AI Workforce CRM</p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </div>
    </div>
  )
}
