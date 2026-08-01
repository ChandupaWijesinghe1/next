"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getCurrentUser,
  listNotifications,
  markNotificationRead,
} from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export function NotificationsView() {
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: getCurrentUser,
  })

  const userId = meQuery.data?.id ?? null

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(userId ?? 0, false),
    queryFn: () => listNotifications(userId!, { unreadOnly: false }),
    enabled: userId != null,
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => markNotificationRead(notificationId),
    onSuccess: () => {
      if (userId == null) return
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, false) })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, true) })
    },
  })

  const notifications = notificationsQuery.data ?? []
  const loading = meQuery.isLoading || notificationsQuery.isLoading
  const error =
    meQuery.error != null
      ? getErrorMessage(meQuery.error, "Unable to load user.")
      : notificationsQuery.error != null
        ? getErrorMessage(notificationsQuery.error, "Unable to load notifications.")
        : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground">
          View unread and previous notifications for your account.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <Badge variant={notification.is_read ? "secondary" : "default"}>
                    {notification.is_read ? "Read" : "Unread"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(notification.created_at)}
                </p>
              </div>

              {!notification.is_read ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={markReadMutation.isPending}
                  onClick={() => markReadMutation.mutate(notification.id)}
                >
                  Mark as read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
