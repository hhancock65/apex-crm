import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TagInput } from "@/components/contacts/TagInput"
import { useCompanies } from "@/hooks/useCompanies"
import { useContactTags, useCreateContact } from "@/hooks/useContacts"
import { contactFormSchema, type ContactFormValues } from "@/lib/validation/contact"

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_VALUES: ContactFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_id: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const createContact = useCreateContact()
  const { data: companies } = useCompanies()
  const { data: existingTags } = useContactTags()
  const [tags, setTags] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const companyId = watch("company_id")

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(DEFAULT_VALUES)
      setTags([])
    }
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createContact.mutateAsync({
        first_name: values.first_name.trim(),
        last_name: values.last_name?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        company_id: values.company_id || null,
        address: values.address?.trim() || null,
        city: values.city?.trim() || null,
        state: values.state?.trim() || null,
        zip: values.zip?.trim() || null,
        tags,
        notes: values.notes?.trim() || null,
      })
      toast.success("Contact created")
      reset(DEFAULT_VALUES)
      setTags([])
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create contact", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company_id">Company</Label>
            <Select
              value={companyId || "none"}
              onValueChange={(value) => setValue("company_id", value === "none" ? "" : value)}
            >
              <SelectTrigger id="company_id">
                <SelectValue placeholder="No company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" {...register("zip")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={existingTags} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
