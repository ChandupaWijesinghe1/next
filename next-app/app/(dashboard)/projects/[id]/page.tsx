import { ProjectDetailView } from "@/components/projects/project-detail-view"

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ team?: string }>
}) {
  const { id } = await params
  const { team } = await searchParams
  const projectId = Number(id)
  const teamId = team ? Number(team) : null

  return (
    <ProjectDetailView
      projectId={projectId}
      teamIdFromQuery={Number.isFinite(teamId) ? teamId : null}
    />
  )
}
