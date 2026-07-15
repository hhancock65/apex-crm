export interface PaymentMethodSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export interface InvoiceSummary {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  pdfUrl: string | null
  hostedUrl: string | null
}

export interface BillingDetails {
  paymentMethod: PaymentMethodSummary | null
  invoices: InvoiceSummary[]
}
