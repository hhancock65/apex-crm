export interface UsageRecord {
  id: string
  org_id: string
  period_start: string
  period_end: string
  ai_minutes_used: number
  sms_sent: number
  calls_made: number
  ai_minutes_included: number
  sms_included: number
  calls_included: number
  overage_amount: number
  invoiced_at: string | null
  created_at: string
  updated_at: string
}
