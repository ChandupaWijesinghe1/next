"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

import {
  createComment,
  createTask,
  deleteAttachment,
  deleteComment,
  deleteTask,
  getCurrentUser,
  getProject,
  listAttachments,
  listComments,
  listTeamMembers,
  listTasks,
  listUsers,
  updateProject,
  updateTask,
  uploadAttachment,
} from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import { getSelectedTeamId } from "@/lib/team"
import type { Attachment, Task } from "@/types/api"
import { TASK_STATUSES } from "@/types/api"
import { TaskStatusBadge } from "@/components/tasks/task-status-badge"
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

type ProjectsDetailViewProps = {
  projectId: number
  teamIdFromQuery: number | null
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectDetailView({
  projectId,
  teamIdFromQuery,
}: ProjectsDetailViewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState<number | null>(teamIdFromQuery)

  useEffect(() => {
    if (teamIdFromQuery != null) {
      setTeamId(teamIdFromQuery)
      return
    }
    setTeamId(getSelectedTeamId())
  }, [teamIdFromQuery])

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [commentBody, setCommentBody] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const missingTeam = teamId == null

  const projectQuery = useQuery({
    queryKey: queryKeys.project(teamId!, projectId),
    queryFn: () => getProject(teamId!, projectId),
    enabled: teamId != null,
  })

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks(teamId!, projectId),
    queryFn: () => listTasks(teamId!, projectId),
    enabled: teamId != null,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.teamMembers(teamId!),
    queryFn: () => listTeamMembers(teamId!),
    enabled: teamId != null,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: listUsers,
    enabled: teamId != null,
  })

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: getCurrentUser,
    enabled: teamId != null,
  })

  const project = projectQuery.data ?? null
  const tasks = tasksQuery.data ?? []
  const members = membersQuery.data ?? []
  const users = usersQuery.data ?? []
  const currentUser = meQuery.data ?? null

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(null)
      return
    }
    setSelectedTaskId((current) => {
      if (current != null && tasks.some((task) => task.id === current)) {
        return current
      }
      return tasks[0].id
    })
  }, [tasks])

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(teamId!, projectId, selectedTaskId!),
    queryFn: () => listComments(teamId!, projectId, selectedTaskId!),
    enabled: teamId != null && selectedTaskId != null,
  })

  const attachmentsQuery = useQuery({
    queryKey: queryKeys.attachments(selectedTaskId!),
    queryFn: () => listAttachments(selectedTaskId!),
    enabled: selectedTaskId != null,
  })

  const comments = commentsQuery.data ?? []
  const attachments = attachmentsQuery.data ?? []
  const sideLoading =
    commentsQuery.isFetching || attachmentsQuery.isFetching

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  )

  const memberOptions = useMemo(() => {
    return members.map((member) => {
      const user = users.find((item) => item.id === member.user_id)
      return {
        userId: member.user_id,
        role: member.role,
        label: user
          ? `${user.full_name} · ${member.role}`
          : `User #${member.user_id} · ${member.role}`,
      }
    })
  }, [members, users])

  const loading =
    !missingTeam &&
    (projectQuery.isLoading ||
      tasksQuery.isLoading ||
      membersQuery.isLoading ||
      usersQuery.isLoading ||
      meQuery.isLoading)

  const loadError = missingTeam
    ? "Select a team from the Projects page first."
    : projectQuery.error != null
      ? getErrorMessage(projectQuery.error, "Unable to load project.")
      : tasksQuery.error != null
        ? getErrorMessage(tasksQuery.error, "Unable to load project.")
        : membersQuery.error != null
          ? getErrorMessage(membersQuery.error, "Unable to load project.")
          : usersQuery.error != null
            ? getErrorMessage(usersQuery.error, "Unable to load project.")
            : meQuery.error != null
              ? getErrorMessage(meQuery.error, "Unable to load project.")
              : commentsQuery.error != null || attachmentsQuery.error != null
                ? getErrorMessage(
                    commentsQuery.error ?? attachmentsQuery.error,
                    "Unable to load comments or attachments."
                  )
                : null

  const error = actionError ?? loadError

  const createTaskMutation = useMutation({
    mutationFn: (body: {
      title: string
      description: string | null
      assigned_to: number | null
    }) => createTask(teamId!, projectId, body),
    onSuccess: async (task) => {
      setSelectedTaskId(task.id)
      setTitle("")
      setDescription("")
      setAssignedTo("")
      setCreateOpen(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(teamId!, projectId),
      })
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to create task."))
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      updateProject(teamId!, project!.id, body),
    onSuccess: async () => {
      setEditOpen(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.project(teamId!, projectId),
      })
    },
    onError: (err) => {
      setEditError(getErrorMessage(err, "Unable to update project."))
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      taskId: number
      body: { status?: string; assigned_to?: number | null }
    }) => updateTask(teamId!, projectId, taskId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(teamId!, projectId),
      })
    },
    onError: (err) => {
      setActionError(getErrorMessage(err, "Unable to update task."))
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(teamId!, projectId, taskId),
    onSuccess: async (_data, taskId) => {
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null)
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(teamId!, projectId),
      })
    },
    onError: (err) => {
      setActionError(getErrorMessage(err, "Unable to delete task."))
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: (body: string) =>
      createComment(teamId!, projectId, selectedTaskId!, { body }),
    onSuccess: async () => {
      setCommentBody("")
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments(teamId!, projectId, selectedTaskId!),
      })
    },
    onError: (err) => {
      setCommentError(getErrorMessage(err, "Unable to add comment."))
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) =>
      deleteComment(teamId!, projectId, selectedTaskId!, commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments(teamId!, projectId, selectedTaskId!),
      })
    },
    onError: (err) => {
      setCommentError(getErrorMessage(err, "Unable to delete comment."))
    },
  })

  const uploadAttachmentMutation = useMutation({
    mutationFn: (nextFile: File) =>
      uploadAttachment(selectedTaskId!, nextFile),
    onSuccess: async () => {
      setFile(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.attachments(selectedTaskId!),
      })
    },
    onError: (err) => {
      setAttachmentError(getErrorMessage(err, "Unable to upload attachment."))
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => deleteAttachment(attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.attachments(selectedTaskId!),
      })
    },
    onError: (err) => {
      setAttachmentError(getErrorMessage(err, "Unable to delete attachment."))
    },
  })

  function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId) return
    setFormError(null)
    createTaskMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo ? Number(assignedTo) : null,
    })
  }

  function openEditProject() {
    if (!project) return
    setEditName(project.name)
    setEditDescription(project.description ?? "")
    setEditError(null)
    setEditOpen(true)
  }

  function handleUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId || !project) return
    setEditError(null)
    updateProjectMutation.mutate({
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
  }

  function handleStatusChange(task: Task, status: string) {
    if (!teamId) return
    setActionError(null)
    updateTaskMutation.mutate({ taskId: task.id, body: { status } })
  }

  function handleAssigneeChange(task: Task, nextAssignee: string) {
    if (!teamId) return
    setActionError(null)
    updateTaskMutation.mutate({
      taskId: task.id,
      body: { assigned_to: nextAssignee ? Number(nextAssignee) : null },
    })
  }

  function handleDeleteTask(taskId: number) {
    if (!teamId) return
    if (!window.confirm("Delete this task?")) return
    setActionError(null)
    deleteTaskMutation.mutate(taskId)
  }

  function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId || !selectedTaskId) return
    setCommentError(null)
    createCommentMutation.mutate(commentBody.trim())
  }

  function handleDeleteComment(commentId: number) {
    if (!teamId || !selectedTaskId) return
    if (!window.confirm("Delete this comment?")) return
    setCommentError(null)
    deleteCommentMutation.mutate(commentId)
  }

  function handleUploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTaskId || !file) return
    setAttachmentError(null)
    const form = event.currentTarget
    uploadAttachmentMutation.mutate(file, {
      onSuccess: () => form.reset(),
    })
  }

  function handleDeleteAttachment(attachment: Attachment) {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return
    setAttachmentError(null)
    deleteAttachmentMutation.mutate(attachment.id)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to projects
        </Button>
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to projects
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {project?.name}
            </h2>
            <p className="text-muted-foreground">
              {project?.description || "No description provided."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={openEditProject}>
              Edit
            </Button>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger render={<Button />}>
                <Plus data-icon="inline-start" />
                New task
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateTask} className="grid gap-4">
                  <DialogHeader>
                    <DialogTitle>Create task</DialogTitle>
                    <DialogDescription>
                      Add a task under this project and optionally assign it.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <label htmlFor="task-title" className="text-sm font-medium">
                      Title
                    </label>
                    <Input
                      id="task-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Implement comments UI"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="task-description"
                      className="text-sm font-medium"
                    >
                      Description
                    </label>
                    <textarea
                      id="task-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional details"
                      rows={3}
                      className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="task-assignee"
                      className="text-sm font-medium"
                    >
                      Assign to
                    </label>
                    <select
                      id="task-assignee"
                      value={assignedTo}
                      onChange={(event) => setAssignedTo(event.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    >
                      <option value="">Unassigned</option>
                      {memberOptions.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending
                        ? "Creating..."
                        : "Create task"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateProject} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription>
                Update the project name and description.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label
                htmlFor="edit-project-name-detail"
                className="text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="edit-project-name-detail"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-project-description-detail"
                className="text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="edit-project-description-detail"
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
                {updateProjectMutation.isPending
                  ? "Saving..."
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No tasks yet. Create one to start tracking work.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow
                  key={task.id}
                  data-state={
                    task.id === selectedTaskId ? "selected" : undefined
                  }
                  className="cursor-pointer"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/tasks/${task.id}?team=${teamId}&project=${projectId}`}
                      className="hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      <select
                        aria-label={`Status for ${task.title}`}
                        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none"
                        value={task.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleStatusChange(task, event.target.value)
                        }
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ")}
                          </option>
                        ))}
                        {!TASK_STATUSES.includes(
                          task.status as (typeof TASK_STATUSES)[number]
                        ) ? (
                          <option value={task.status}>{task.status}</option>
                        ) : null}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Assignee for ${task.title}`}
                      className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none"
                      value={task.assigned_to ?? ""}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        handleAssigneeChange(task, event.target.value)
                      }
                    >
                      <option value="">Unassigned</option>
                      {memberOptions.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDeleteTask(task.id)
                      }}
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">
              Comments & attachments
            </h3>
            <p className="text-sm text-muted-foreground">
              Select a project task, then add comments or upload files for it.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="selected-task" className="text-sm font-medium">
              Task for this project
            </label>
            <select
              id="selected-task"
              className="h-8 min-w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              value={selectedTaskId ?? ""}
              onChange={(event) =>
                setSelectedTaskId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
              disabled={tasks.length === 0}
            >
              {tasks.length === 0 ? (
                <option value="">No tasks available</option>
              ) : (
                tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {!selectedTask ? (
          <p className="text-sm text-muted-foreground">
            Create or select a task first to add comments and attachments.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Working on{" "}
              <Link
                href={`/tasks/${selectedTask.id}?team=${teamId}&project=${projectId}`}
                className="font-medium underline"
              >
                {selectedTask.title}
              </Link>
              {sideLoading ? " (loading...)" : null}
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <form
                  onSubmit={handleAddComment}
                  className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="project-comment"
                      className="text-sm font-medium"
                    >
                      Add comment
                    </label>
                    <textarea
                      id="project-comment"
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Write a comment for this task..."
                      rows={3}
                      required
                      maxLength={2000}
                      className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  {commentError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {commentError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={
                      createCommentMutation.isPending || !commentBody.trim()
                    }
                    className="self-start"
                  >
                    {createCommentMutation.isPending
                      ? "Posting..."
                      : "Post comment"}
                  </Button>
                </form>

                <div className="rounded-xl ring-1 ring-foreground/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Author</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead className="w-28 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No comments for this task.
                          </TableCell>
                        </TableRow>
                      ) : (
                        comments.map((comment) => (
                          <TableRow key={comment.id}>
                            <TableCell className="text-muted-foreground">
                              User #{comment.created_by}
                              {currentUser?.id === comment.created_by
                                ? " (you)"
                                : ""}
                            </TableCell>
                            <TableCell className="whitespace-pre-wrap">
                              {comment.body}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                  deleteCommentMutation.isPending &&
                                  deleteCommentMutation.variables === comment.id
                                }
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                {deleteCommentMutation.isPending &&
                                deleteCommentMutation.variables === comment.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-4">
                <form
                  onSubmit={handleUploadAttachment}
                  className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="project-attachment"
                      className="text-sm font-medium"
                    >
                      Upload attachment
                    </label>
                    <Input
                      id="project-attachment"
                      type="file"
                      required
                      onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  {attachmentError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {attachmentError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={uploadAttachmentMutation.isPending || !file}
                    className="self-start"
                  >
                    {uploadAttachmentMutation.isPending
                      ? "Uploading..."
                      : "Upload attachment"}
                  </Button>
                </form>

                <div className="rounded-xl ring-1 ring-foreground/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploader</TableHead>
                        <TableHead className="w-28 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attachments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No attachments for this task.
                          </TableCell>
                        </TableRow>
                      ) : (
                        attachments.map((attachment) => (
                          <TableRow key={attachment.id}>
                            <TableCell className="font-medium">
                              {attachment.file_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatBytes(attachment.size_bytes)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              User #{attachment.uploaded_by}
                              {currentUser?.id === attachment.uploaded_by
                                ? " (you)"
                                : ""}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                  deleteAttachmentMutation.isPending &&
                                  deleteAttachmentMutation.variables ===
                                    attachment.id
                                }
                                onClick={() =>
                                  handleDeleteAttachment(attachment)
                                }
                              >
                                {deleteAttachmentMutation.isPending &&
                                deleteAttachmentMutation.variables ===
                                  attachment.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
