export const queryKeys = {
  teams: ["teams"] as const,
  users: ["users"] as const,
  me: ["me"] as const,
  teamMembers: (teamId: number) => ["teams", teamId, "members"] as const,
  projects: (teamId: number) => ["teams", teamId, "projects"] as const,
  project: (teamId: number, projectId: number) =>
    ["teams", teamId, "projects", projectId] as const,
  tasks: (teamId: number, projectId: number) =>
    ["teams", teamId, "projects", projectId, "tasks"] as const,
  task: (teamId: number, projectId: number, taskId: number) =>
    ["teams", teamId, "projects", projectId, "tasks", taskId] as const,
  comments: (teamId: number, projectId: number, taskId: number) =>
    [
      "teams",
      teamId,
      "projects",
      projectId,
      "tasks",
      taskId,
      "comments",
    ] as const,
  attachments: (taskId: number) => ["tasks", taskId, "attachments"] as const,
  notifications: (userId: number, unreadOnly = true) =>
    ["notifications", userId, unreadOnly ? "unread" : "all"] as const,
}
