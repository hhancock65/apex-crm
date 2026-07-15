export interface Notification {
  id: string
  org_id: string
  user_id: string
  type: string
  title: string
  message: string | null
  read: boolean
  related_to_type: string | null
  related_to_id: string | null
  created_at: string
}
