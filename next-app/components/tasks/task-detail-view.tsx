"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Download, Trash2 } from "lucide-react"

import {
  createComment,
  deleteAttachment,
  deleteComment,
  getAttachmentDownload,
  getCurrentUser,
  getTask,
  listAttachments,
  listComments,
  updateTask,
  uploadAttachment,
} from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import { getSelectedTeamId } from "@/lib/team"
import type { Attachment } from "@/types/api"
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

type TaskDetailViewProps = {
  taskId: number
  teamIdFromQuery: number | null
  projectIdFromQuery: number | null
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskDetailView({
  taskId,
  teamIdFromQuery,
  projectIdFromQuery,
}: TaskDetailViewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState<number | null>(teamIdFromQuery)
  const projectId = projectIdFromQuery

  const [body, setBody] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (teamIdFromQuery != null) {
      setTeamId(teamIdFromQuery)
      return
    }
    setTeamId(getSelectedTeamId())
  }, [teamIdFromQuery])

  const canLoad = projectId != null && teamId != null

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: getCurrentUser,
    enabled: canLoad,
  })

  const taskQuery = useQuery({
    queryKey: queryKeys.task(teamId!, projectId!, taskId),
    queryFn: () => getTask(teamId!, projectId!, taskId),
    enabled: canLoad,
  })

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(teamId!, projectId!, taskId),
    queryFn: () => listComments(teamId!, projectId!, taskId),
    enabled: canLoad,
  })

  const attachmentsQuery = useQuery({
    queryKey: queryKeys.attachments(taskId),
    queryFn: () => listAttachments(taskId),
    enabled: canLoad,
  })

  const user = meQuery.data ?? null
  const task = taskQuery.data ?? null
  const comments = commentsQuery.data ?? []
  const attachments = attachmentsQuery.data ?? []

  const loading =
    canLoad &&
    (meQuery.isLoading ||
      taskQuery.isLoading ||
      commentsQuery.isLoading ||
      attachmentsQuery.isLoading)

  const loadError =
    !projectId || (teamId == null && teamIdFromQuery == null)
      ? "Missing team or project. Open this task from a project page."
      : taskQuery.error != null
        ? getErrorMessage(taskQuery.error, "Unable to load task.")
        : meQuery.error != null
          ? getErrorMessage(meQuery.error, "Unable to load task.")
          : commentsQuery.error != null
            ? getErrorMessage(commentsQuery.error, "Unable to load task.")
            : attachmentsQuery.error != null
              ? getErrorMessage(attachmentsQuery.error, "Unable to load task.")
              : null

  const error = actionError ?? loadError

  const updateTaskMutation = useMutation({
    mutationFn: (body: {
      status?: string
      title?: string
      description?: string | null
    }) => updateTask(teamId!, projectId!, taskId, body),
    onSuccess: async () => {
      setEditOpen(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.task(teamId!, projectId!, taskId),
      })
    },
    onError: (err) => {
      if (editOpen) {
        setEditError(getErrorMessage(err, "Unable to update task."))
      } else {
        setActionError(getErrorMessage(err, "Unable to update status."))
      }
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: (nextBody: string) =>
      createComment(teamId!, projectId!, taskId, { body: nextBody }),
    onSuccess: async () => {
      setBody("")
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments(teamId!, projectId!, taskId),
      })
    },
    onError: (err) => {
      setCommentError(getErrorMessage(err, "Unable to add comment."))
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) =>
      deleteComment(teamId!, projectId!, taskId, commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments(teamId!, projectId!, taskId),
      })
    },
    onError: (err) => {
      setCommentError(getErrorMessage(err, "Unable to delete comment."))
    },
  })

  const uploadAttachmentMutation = useMutation({
    mutationFn: (nextFile: File) => uploadAttachment(taskId, nextFile),
    onSuccess: async () => {
      setFile(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.attachments(taskId),
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
        queryKey: queryKeys.attachments(taskId),
      })
    },
    onError: (err) => {
      setAttachmentError(getErrorMessage(err, "Unable to delete attachment."))
    },
  })

  const downloadAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => getAttachmentDownload(attachmentId),
    onSuccess: ({ download_url }) => {
      window.open(download_url, "_blank", "noopener,noreferrer")
    },
    onError: (err) => {
      setAttachmentError(getErrorMessage(err, "Unable to download file."))
    },
  })

  function handleStatusChange(status: string) {
    if (!teamId || !projectId || !task) return
    setActionError(null)
    updateTaskMutation.mutate({ status })
  }

  function openEditTask() {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description ?? "")
    setEditError(null)
    setEditOpen(true)
  }

  function handleUpdateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId || !projectId || !task) return
    setEditError(null)
    updateTaskMutation.mutate({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    })
  }

  function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId || !projectId) return
    setCommentError(null)
    createCommentMutation.mutate(body.trim())
  }

  function handleDeleteComment(commentId: number) {
    if (!teamId || !projectId) return
    if (!window.confirm("Delete this comment?")) return
    setCommentError(null)
    deleteCommentMutation.mutate(commentId)
  }

  function handleUploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setAttachmentError(null)
    const form = event.currentTarget
    uploadAttachmentMutation.mutate(file, {
      onSuccess: () => form.reset(),
    })
  }

  function handleDownloadAttachment(attachment: Attachment) {
    setAttachmentError(null)
    downloadAttachmentMutation.mutate(attachment.id)
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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error && !task) {
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
          onClick={() =>
            router.push(
              projectId && teamId
                ? `/projects/${projectId}?team=${teamId}`
                : "/projects"
            )
          }
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to project
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {task?.title}
              </h2>
              {task ? <TaskStatusBadge status={task.status} /> : null}
            </div>
            <p className="text-muted-foreground">
              {task?.description || "No description provided."}
            </p>
          </div>

          {task ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={openEditTask}>
                Edit
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                  value={task.status}
                  onChange={(event) => handleStatusChange(event.target.value)}
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
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateTask} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit task</DialogTitle>
              <DialogDescription>
                Update the task name and description.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="edit-task-title" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="edit-task-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-task-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="edit-task-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Optional details"
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {editError ? (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={updateTaskMutation.isPending}>
                {updateTaskMutation.isPending ? "Saving..." : "Save changes"}
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

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">Comments</h3>
          <p className="text-sm text-muted-foreground">
            Discuss this task with your team.
          </p>
        </div>

        <form
          onSubmit={handleAddComment}
          className="flex max-w-lg flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
        >
          <div className="space-y-2">
            <label htmlFor="comment-body" className="text-sm font-medium">
              New comment
            </label>
            <textarea
              id="comment-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a comment..."
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
            disabled={createCommentMutation.isPending || !body.trim()}
            className="self-start"
          >
            {createCommentMutation.isPending ? "Posting..." : "Post comment"}
          </Button>
        </form>

        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-24">ID</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No comments yet.
                  </TableCell>
                </TableRow>
              ) : (
                comments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="text-muted-foreground">
                      User #{comment.created_by}
                      {user?.id === comment.created_by ? " (you)" : ""}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap">
                      {comment.body}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      #{comment.id}
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
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">Attachments</h3>
          <p className="text-sm text-muted-foreground">
            Upload and manage files for this task.
          </p>
        </div>

        <form
          onSubmit={handleUploadAttachment}
          className="flex max-w-lg flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
        >
          <div className="space-y-2">
            <label htmlFor="attachment-file" className="text-sm font-medium">
              Upload file
            </label>
            <Input
              id="attachment-file"
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
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No attachments yet.
                  </TableCell>
                </TableRow>
              ) : (
                attachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell className="font-medium">
                      {attachment.file_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {attachment.content_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatBytes(attachment.size_bytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      User #{attachment.uploaded_by}
                      {user?.id === attachment.uploaded_by ? " (you)" : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAttachment(attachment)}
                        >
                          <Download data-icon="inline-start" />
                          Download
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={
                            deleteAttachmentMutation.isPending &&
                            deleteAttachmentMutation.variables === attachment.id
                          }
                          onClick={() => handleDeleteAttachment(attachment)}
                        >
                          {deleteAttachmentMutation.isPending &&
                          deleteAttachmentMutation.variables === attachment.id ? (
                            "Deleting..."
                          ) : (
                            <>
                              <Trash2 data-icon="inline-start" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Looking for the project list?{" "}
        <Link href="/projects" className="underline">
          Go to projects
        </Link>
        .
      </p>
    </div>
  )
}
