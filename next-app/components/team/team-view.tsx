"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  addTeamMember,
  createTeam,
  deleteTeam,
  listTeamMembers,
  listTeams,
  listUsers,
  removeTeamMember,
  updateTeam,
} from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import {
  clearSelectedTeamId,
  getSelectedTeamId,
  setSelectedTeamId,
} from "@/lib/team"
import type { Team, TeamMember } from "@/types/api"
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

export function TeamView() {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState<number | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const [memberUserId, setMemberUserId] = useState("")
  const [memberRole, setMemberRole] = useState("member")
  const [memberError, setMemberError] = useState<string | null>(null)

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams,
    queryFn: listTeams,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: listUsers,
  })

  const teams = teamsQuery.data ?? []
  const users = usersQuery.data ?? []

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

  const membersQuery = useQuery({
    queryKey: queryKeys.teamMembers(resolvedTeamId!),
    queryFn: () => listTeamMembers(resolvedTeamId!),
    enabled: resolvedTeamId != null,
  })

  const members = membersQuery.data ?? []
  const selectedTeam =
    teams.find((team) => team.id === resolvedTeamId) ?? null

  const memberUserIds = useMemo(
    () => new Set(members.map((member) => member.user_id)),
    [members]
  )

  const availableUsers = useMemo(
    () => users.filter((user) => !memberUserIds.has(user.id)),
    [memberUserIds, users]
  )

  const loading =
    teamsQuery.isLoading ||
    usersQuery.isLoading ||
    (resolvedTeamId != null && membersQuery.isFetching)

  const error =
    teamsQuery.error != null
      ? getErrorMessage(teamsQuery.error, "Unable to load teams.")
      : usersQuery.error != null
        ? getErrorMessage(usersQuery.error, "Unable to load teams.")
        : membersQuery.error != null
          ? getErrorMessage(membersQuery.error, "Unable to load members.")
          : null

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: async (team) => {
      setSelectedTeamId(team.id)
      setTeamId(team.id)
      setName("")
      setDescription("")
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams })
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to create team."))
    },
  })

  const updateTeamMutation = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      updateTeam(selectedTeam!.id, body),
    onSuccess: async () => {
      setEditOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams })
    },
    onError: (err) => {
      setEditError(getErrorMessage(err, "Unable to update team."))
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: (id: number) => deleteTeam(id),
    onSuccess: async (_data, deletedId) => {
      if (getSelectedTeamId() === deletedId) {
        clearSelectedTeamId()
      }
      if (teamId === deletedId) {
        setTeamId(null)
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams })
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, "Unable to delete team."))
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (body: { user_id: number; role: string }) =>
      addTeamMember(resolvedTeamId!, body),
    onSuccess: async () => {
      setMemberUserId("")
      setMemberRole("member")
      if (resolvedTeamId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.teamMembers(resolvedTeamId),
        })
      }
    },
    onError: (err) => {
      setMemberError(getErrorMessage(err, "Unable to add member."))
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) =>
      removeTeamMember(resolvedTeamId!, userId),
    onSuccess: async () => {
      if (resolvedTeamId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.teamMembers(resolvedTeamId),
        })
      }
    },
    onError: (err) => {
      setMemberError(getErrorMessage(err, "Unable to remove member."))
    },
  })

  function handleTeamChange(nextTeamId: number) {
    setTeamId(nextTeamId)
    setSelectedTeamId(nextTeamId)
    setMemberError(null)
  }

  function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    createTeamMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
    })
  }

  function openEditDialog(team: Team) {
    setEditName(team.name)
    setEditDescription(team.description ?? "")
    setEditError(null)
    setEditOpen(true)
  }

  function handleUpdateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTeam) return
    setEditError(null)
    updateTeamMutation.mutate({
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
  }

  function handleDeleteTeam(team: Team) {
    const confirmed = window.confirm(
      `Delete team "${team.name}"? This also removes its projects and cannot be undone.`
    )
    if (!confirmed) return
    setFormError(null)
    deleteTeamMutation.mutate(team.id)
  }

  function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedTeamId) return

    const userId = Number(memberUserId)
    if (!Number.isFinite(userId) || userId <= 0) {
      setMemberError("Enter a valid user ID.")
      return
    }

    setMemberError(null)
    addMemberMutation.mutate({
      user_id: userId,
      role: memberRole,
    })
  }

  function handleRemoveMember(member: TeamMember) {
    if (!resolvedTeamId) return
    const confirmed = window.confirm(
      `Remove user #${member.user_id} from this team?`
    )
    if (!confirmed) return
    setMemberError(null)
    removeMemberMutation.mutate(member.user_id)
  }

  if (teamsQuery.isLoading && teams.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <p className="text-muted-foreground">
          Create teams, update details, and manage members.
        </p>
      </div>

      <form
        onSubmit={handleCreateTeam}
        className="flex max-w-lg flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
      >
        <div className="space-y-2">
          <label htmlFor="new-team-name" className="text-sm font-medium">
            Team name
          </label>
          <Input
            id="new-team-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Team name"
            required
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="new-team-description"
            className="text-sm font-medium"
          >
            Description
          </label>
          <Input
            id="new-team-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this team work on?"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={createTeamMutation.isPending}
          className="self-start"
        >
          {createTeamMutation.isPending ? "Creating..." : "Create team"}
        </Button>
      </form>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">ID</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No teams yet.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow
                  key={team.id}
                  data-state={
                    team.id === resolvedTeamId ? "selected" : undefined
                  }
                  className="cursor-pointer"
                  onClick={() => handleTeamChange(team.id)}
                >
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {team.description || "—"}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {team.subscription_status}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    #{team.id}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          setTeamId(team.id)
                          setSelectedTeamId(team.id)
                          openEditDialog(team)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={
                          deleteTeamMutation.isPending &&
                          deleteTeamMutation.variables === team.id
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteTeam(team)
                        }}
                      >
                        {deleteTeamMutation.isPending &&
                        deleteTeamMutation.variables === team.id
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateTeam} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Update team</DialogTitle>
              <DialogDescription>
                Change the selected team name and description.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="edit-team-name" className="text-sm font-medium">
                Team name
              </label>
              <Input
                id="edit-team-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-team-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Input
                id="edit-team-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Optional description"
              />
            </div>

            {editError ? (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={updateTeamMutation.isPending}>
                {updateTeamMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {resolvedTeamId ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">
              Members{selectedTeam ? ` · ${selectedTeam.name}` : ""}
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose a registered user and role, then add them to this team.
            </p>
          </div>

          <form
            onSubmit={handleAddMember}
            className="flex max-w-lg flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <label htmlFor="member-user-id" className="text-sm font-medium">
                User
              </label>
              <select
                id="member-user-id"
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="">Select a user</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    #{user.id} · {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="member-role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="member-role"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={
                addMemberMutation.isPending || availableUsers.length === 0
              }
            >
              {addMemberMutation.isPending ? "Adding..." : "Add member"}
            </Button>
          </form>

          {memberError ? (
            <p className="text-sm text-destructive" role="alert">
              {memberError}
            </p>
          ) : null}

          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const user = users.find(
                      (item) => item.id === member.user_id
                    )
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          {user
                            ? `${user.full_name} (#${member.user_id})`
                            : `#${member.user_id}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user?.email ?? "—"}
                        </TableCell>
                        <TableCell className="capitalize">{member.role}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={
                              removeMemberMutation.isPending &&
                              removeMemberMutation.variables === member.user_id
                            }
                            onClick={() => handleRemoveMember(member)}
                          >
                            {removeMemberMutation.isPending &&
                            removeMemberMutation.variables === member.user_id
                              ? "Removing..."
                              : "Remove"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
