import { CreateOrganization, SignedIn, SignedOut, SignUp, useOrganization } from "@clerk/clerk-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRegisterPartner } from "@/hooks/usePartner"

/**
 * Full self-serve flow in one page, gated by Clerk's own control
 * components (no custom auth state machine needed): sign up → create the
 * partner's own Clerk Organization (Clerk's built-in <CreateOrganization>,
 * not a custom form) → submit business details → pending JHDM approval.
 * Uses `routing="hash"` for <SignUp> since this is a standalone entry
 * point without its own nested route tree (unlike /sign-up).
 */
export default function PartnerRegistrationPage() {
  return (
    <div className="min-h-screen bg-apex-navy px-4 py-10">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Become an APEX<span className="text-apex-teal">-CRM</span> Partner
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Resell Apex-powered AI Employees to your own clients under your own brand.
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <SignedOut>
          <SignUp routing="hash" signInUrl="/sign-in" />
        </SignedOut>
        <SignedIn>
          <PartnerRegistrationFlow />
        </SignedIn>
      </div>
    </div>
  )
}

function PartnerRegistrationFlow() {
  const { organization, isLoaded } = useOrganization()
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState<{ status: string } | null>(null)

  if (!isLoaded) return null

  if (!organization) {
    return (
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-sm text-white/70">
          First, create your agency's own workspace — this is where your team signs in and, once approved, manages
          every client account.
        </p>
        <div className="rounded-lg bg-white p-2">
          <CreateOrganization afterCreateOrganizationUrl="/partner/sign-up" skipInvitationScreen />
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Application submitted</h2>
        <p className="mt-2 text-sm text-slate-500">
          {submitted.status === "active"
            ? "Your partner account is already active."
            : "A JHDM admin will review your application. You'll get access to create client organizations once approved."}
        </p>
        {submitted.status === "active" && (
          <Button className="mt-4" onClick={() => navigate("/partner/dashboard")}>
            Go to Partner Dashboard
          </Button>
        )}
      </div>
    )
  }

  return <PartnerDetailsForm organizationName={organization.name} onSubmitted={setSubmitted} />
}

function PartnerDetailsForm({
  organizationName,
  onSubmitted,
}: {
  organizationName: string
  onSubmitted: (result: { status: string }) => void
}) {
  const [name, setName] = useState(organizationName)
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const registerPartner = useRegisterPartner()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Business name is required")
      return
    }

    try {
      const result = await registerPartner.mutateAsync({
        name: name.trim(),
        contact_name: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
      })
      onSubmitted({ status: result.status })
    } catch (error) {
      toast.error("Failed to submit partner application", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="w-full max-w-lg rounded-lg bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Tell us about your agency</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="partner-name">Business Name</Label>
          <Input id="partner-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner-contact-name">Contact Name</Label>
          <Input id="partner-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner-email">Email</Label>
          <Input id="partner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner-phone">Phone</Label>
          <Input id="partner-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner-website">Website</Label>
          <Input
            id="partner-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />
        </div>
        <Button type="submit" className="w-full" disabled={registerPartner.isPending}>
          {registerPartner.isPending ? "Submitting…" : "Submit Application"}
        </Button>
      </form>
    </div>
  )
}
