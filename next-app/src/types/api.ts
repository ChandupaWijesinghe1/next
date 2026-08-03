export type User = {
  id: number
  email: string
  username: string
  full_name: string
}
//those are objects shape definations.
//those called as alias types.
export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = {
  email: string
  username: string
  password: string
  full_name: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type?: string
}

export type Team = {
  id: number
  name: string
  description?: string | null
  created_by: number
  subscription_status: string
  stripe_subscription_id?: string | null
}

export type TeamMember = {
  id: number
  team_id: number
  user_id: number
  role: string
}

export type Project = {
  id: number
  team_id: number
  name: string
  description?: string | null
  created_by: number
}

export type ProjectCreate = {
  name: string
  description?: string | null
}

export type ProjectUpdate = {
  name?: string
  description?: string | null
}

export type Task = {
  id: number
  project_id: number
  created_by: number
  assigned_to: number | null
  title: string
  description?: string | null
  status: string
}

export type TaskListResponse = {
  items: Task[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export type TaskCreate = {
  title: string
  description?: string | null
  assigned_to?: number | null
}

export type TaskUpdate = {
  title?: string
  description?: string | null
  status?: string | null
  assigned_to?: number | null
}

export type Comment = {
  id: number
  task_id: number
  created_by: number
  body: string
}

export type CommentCreate = {
  body: string
}

export type Attachment = {
  id: number
  task_id: number
  uploaded_by: number
  file_name: string
  content_type: string
  size_bytes: number
  created_at: string
}

export type AttachmentDownload = {
  download_url: string
  expires_in: number
}

export type Notification = {
  id: number
  user_id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
