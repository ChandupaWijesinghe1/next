import { TaskDetailView } from "@/components/tasks/task-detail-view"

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ team?: string; project?: string }>
}) {
  const { id } = await params
  const { team, project } = await searchParams
  const taskId = Number(id)
  const teamId = team ? Number(team) : null
  const projectId = project ? Number(project) : null

  return (
    <TaskDetailView
      taskId={taskId}
      teamIdFromQuery={Number.isFinite(teamId) ? teamId : null}
      projectIdFromQuery={Number.isFinite(projectId) ? projectId : null}
    />
  )
}
