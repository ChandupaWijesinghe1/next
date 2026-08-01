import { clearTokens, getAccessToken } from "@/lib/auth"
import type {
  Attachment,
  AttachmentDownload,
  Comment,
  CommentCreate,
  Notification,
  LoginRequest,
  Project,
  ProjectCreate,
  ProjectUpdate,
  RegisterRequest,
  Task,
  TaskCreate,
  TaskUpdate,
  Team,
  TeamMember,
  TokenResponse,
  User,
} from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

type ApiFetchOptions = RequestInit & {
  auth?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options
  const requestHeaders = new Headers(headers)

  if (
    !requestHeaders.has("Content-Type") &&
    rest.body &&
    !(rest.body instanceof FormData)
  ) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (auth) {
    const token = getAccessToken()
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`

    try {
      const data = (await response.json()) as {
        detail?: string | { msg?: string }[]
        message?: string
      }
      if (typeof data.message === "string") {
        message = data.message
      } else if (typeof data.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        message = data.detail[0].msg
      }
    } catch {
      // ignore JSON parse errors
    }

    if (response.status === 401) {
      clearTokens()
    }

    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function login(payload: LoginRequest) {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  })
}

export function register(payload: RegisterRequest) {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  })
}

export function getCurrentUser() {
  return apiFetch<User>("/auth/me")
}

export function listUsers() {
  return apiFetch<User[]>("/users")
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
  })
}

// Teams
export function listTeams() {
  return apiFetch<Team[]>("/teams")
}

export function createTeam(body: { name: string; description?: string | null }) {
  return apiFetch<Team>("/teams", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateTeam(
  teamId: number,
  body: { name?: string; description?: string | null }
) {
  return apiFetch<Team>(`/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export function deleteTeam(teamId: number) {
  return apiFetch<void>(`/teams/${teamId}`, {
    method: "DELETE",
  })
}

export function listTeamMembers(teamId: number) {
  return apiFetch<TeamMember[]>(`/teams/${teamId}/members`)
}

export function addTeamMember(
  teamId: number,
  body: { user_id: number; role?: string }
) {
  return apiFetch<TeamMember>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function removeTeamMember(teamId: number, userId: number) {
  return apiFetch<void>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  })
}

// Projects
export function listProjects(teamId: number) {
  return apiFetch<Project[]>(`/teams/${teamId}/projects`)
}

export function getProject(teamId: number, projectId: number) {
  return apiFetch<Project>(`/teams/${teamId}/projects/${projectId}`)
}

export function createProject(teamId: number, body: ProjectCreate) {
  return apiFetch<Project>(`/teams/${teamId}/projects`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateProject(
  teamId: number,
  projectId: number,
  body: ProjectUpdate
) {
  return apiFetch<Project>(`/teams/${teamId}/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export function deleteProject(teamId: number, projectId: number) {
  return apiFetch<void>(`/teams/${teamId}/projects/${projectId}`, {
    method: "DELETE",
  })
}

// Tasks
export function listTasks(teamId: number, projectId: number) {
  return apiFetch<Task[]>(`/teams/${teamId}/projects/${projectId}/tasks`)
}

export function getTask(teamId: number, projectId: number, taskId: number) {
  return apiFetch<Task>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}`
  )
}

export function createTask(
  teamId: number,
  projectId: number,
  body: TaskCreate
) {
  return apiFetch<Task>(`/teams/${teamId}/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateTask(
  teamId: number,
  projectId: number,
  taskId: number,
  body: TaskUpdate
) {
  return apiFetch<Task>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  )
}

export function deleteTask(
  teamId: number,
  projectId: number,
  taskId: number
) {
  return apiFetch<void>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}`,
    {
      method: "DELETE",
    }
  )
}

// Comments
export function listComments(
  teamId: number,
  projectId: number,
  taskId: number
) {
  return apiFetch<Comment[]>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}/comments`
  )
}

export function createComment(
  teamId: number,
  projectId: number,
  taskId: number,
  body: CommentCreate
) {
  return apiFetch<Comment>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
}

export function deleteComment(
  teamId: number,
  projectId: number,
  taskId: number,
  commentId: number
) {
  return apiFetch<void>(
    `/teams/${teamId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    {
      method: "DELETE",
    }
  )
}

// Attachments
export function listAttachments(taskId: number) {
  return apiFetch<Attachment[]>(`/tasks/${taskId}/attachments`)
}

export function uploadAttachment(taskId: number, file: File) {
  const formData = new FormData()
  formData.append("file", file)

  return apiFetch<Attachment>(`/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData,
  })
}

export function getAttachmentDownload(attachmentId: number) {
  return apiFetch<AttachmentDownload>(`/attachments/${attachmentId}/download`)
}

export function deleteAttachment(attachmentId: number) {
  return apiFetch<void>(`/attachments/${attachmentId}`, {
    method: "DELETE",
  })
}

// Notifications (Next.js proxy routes — not the security-demo API base URL)
async function notificationsFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { detail?: string; message?: string }
      if (typeof data.message === "string") message = data.message
      else if (typeof data.detail === "string") message = data.detail
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function listNotifications(
  userId: number,
  options: { unreadOnly?: boolean } = {}
) {
  const unreadOnly = options.unreadOnly ?? true
  const query = new URLSearchParams({
    userId: String(userId),
    unreadOnly: String(unreadOnly),
  })
  return notificationsFetch<Notification[]>(`/api/notifications?${query.toString()}`)
}

export function markNotificationRead(notificationId: number) {
  return notificationsFetch<Notification>(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
  })
}
