"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"

import {
  createProject,
  createTeam,
  deleteProject,
  listProjects,
  listTeams,
  updateProject,
} from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import { getSelectedTeamId, setSelectedTeamId } from "@/lib/team"
import type { Project } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ProjectsView() {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState<number | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams,
    queryFn: listTeams,
  })

  const teams = teamsQuery.data ?? []

  const resolvedTeamId = useMemo(() => {
    if (teams.length === 0) return null
    if (teamId != null && teams.some((team) => team.id === teamId)) {
      return teamId
    }
    const stored = getSelectedTeamId()
    return teams.find((team) => team.id === stored)?.id ?? teams[0].id
  }, [teamId, teams])

  useEffect(() => {
    if (resolvedTeamId != null) {
      setSelectedTeamId(resolvedTeamId)
    }
  }, [resolvedTeamId])

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects(resolvedTeamId!),
    queryFn: () => listProjects(resolvedTeamId!),
    enabled: resolvedTeamId != null,
  })

  const projects = projectsQuery.data ?? []
  const loading = teamsQuery.isLoading || projectsQuery.isFetching
  const error =
    teamsQuery.error != null
      ? getErrorMessage(teamsQuery.error, "Unable to load projects.")
      : projectsQuery.error != null
        ? getErrorMessage(projectsQuery.error, "Unable to load projects.")
        : null

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: async (team) => {
      setSelectedTeamId(team.id)
      setTeamId(team.id)
      setTeamName("")
      setTeamDescription("")
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams })
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to create team."))
    },
  })

  const createProjectMutation = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      createProject(resolvedTeamId!, body),
    onSuccess: async () => {
      setName("")
      setDescription("")
      setCreateOpen(false)
      if (resolvedTeamId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projects(resolvedTeamId),
        })
      }
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to create project."))
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      updateProject(resolvedTeamId!, editingProject!.id, body),
    onSuccess: async () => {
      setEditOpen(false)
      setEditingProject(null)
      if (resolvedTeamId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projects(resolvedTeamId),
        })
      }
    },
    onError: (err) => {
      setEditError(getErrorMessage(err, "Unable to update project."))
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) =>
      deleteProject(resolvedTeamId!, projectId),
    onSuccess: async () => {
      if (resolvedTeamId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projects(resolvedTeamId),
        })
      }
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to delete project."))
    },
  })

  function handleTeamChange(nextTeamId: number) {
    setTeamId(nextTeamId)
    setSelectedTeamId(nextTeamId)
  }

  function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    createTeamMutation.mutate({
      name: teamName.trim(),
      description: teamDescription.trim() || null,
    })
  }

  function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedTeamId) return
    setFormError(null)
    createProjectMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
    })
  }

  function handleDeleteProject(project: Project) {
    if (!resolvedTeamId) return
    const confirmed = window.confirm(
      `Delete project "${project.name}"? This cannot be undone.`
    )
    if (!confirmed) return
    setFormError(null)
    deleteProjectMutation.mutate(project.id)
  }

  function openEditDialog(project: Project) {
    setEditingProject(project)
    setEditName(project.name)
    setEditDescription(project.description ?? "")
    setEditError(null)
    setEditOpen(true)
  }

  function handleUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedTeamId || !editingProject) return
    setEditError(null)
    updateProjectMutation.mutate({
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
  }

  if (teamsQuery.isLoading && teams.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!teamsQuery.isLoading && teams.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            Create a team first, then add projects under it.
          </p>
        </div>

        <form
          onSubmit={handleCreateTeam}
          className="max-w-md space-y-3 rounded-xl ring-1 ring-foreground/10 p-4"
        >
          <div className="space-y-2">
            <label htmlFor="team-name" className="text-sm font-medium">
              Team name
            </label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Product engineering"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="team-description" className="text-sm font-medium">
              Description
            </label>
            <Input
              id="team-description"
              value={teamDescription}
              onChange={(event) => setTeamDescription(event.target.value)}
              placeholder="What does this team work on?"
              required
            />
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={createTeamMutation.isPending}>
            {createTeamMutation.isPending ? "Creating..." : "Create team"}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            Browse and manage projects for the selected team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="team-select" className="sr-only">
            Team
          </label>
          <select
            id="team-select"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={resolvedTeamId ?? undefined}
            onChange={(event) => handleTeamChange(Number(event.target.value))}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Plus data-icon="inline-start" />
              New project
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateProject} className="grid gap-4">
                <DialogHeader>
                  <DialogTitle>Create project</DialogTitle>
                  <DialogDescription>
                    Projects belong to the currently selected team.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Website redesign"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="project-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional notes"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>

                {formError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                ) : null}

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                  >
                    {createProjectMutation.isPending
                      ? "Creating..."
                      : "Create project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">ID</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No projects yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/projects/${project.id}?team=${project.team_id}`}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {project.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    #{project.id}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(project)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={
                          deleteProjectMutation.isPending &&
                          deleteProjectMutation.variables === project.id
                        }
                        onClick={() => handleDeleteProject(project)}
                      >
                        {deleteProjectMutation.isPending &&
                        deleteProjectMutation.variables === project.id
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingProject(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateProject} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription>
                Update the project name and description.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="edit-project-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-project-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="edit-project-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Optional notes"
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {editError ? (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={updateProjectMutation.isPending}
              >
                {updateProjectMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
