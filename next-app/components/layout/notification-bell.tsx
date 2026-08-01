"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getCurrentUser, listNotifications, markNotificationRead } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: getCurrentUser,
  })

  const userId = meQuery.data?.id ?? null

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(userId ?? 0, true),
    queryFn: () => listNotifications(userId!, { unreadOnly: true }),
    enabled: userId != null,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => markNotificationRead(notificationId),
    onSuccess: (_data, notificationId) => {
      if (userId == null) return
      queryClient.setQueryData<Awaited<ReturnType<typeof listNotifications>>>(
        queryKeys.notifications(userId, true),
        (current) => (current ?? []).filter((item) => item.id !== notificationId)
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, true) })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, false) })
    },
  })

  const notifications = notificationsQuery.data ?? []
  const unreadCount = notifications.length

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen && userId != null) {
          void notificationsQuery.refetch()
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Open notifications"
          >
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {notificationsQuery.isLoading || notificationsQuery.isFetching ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>
        ) : notificationsQuery.isError ? (
          <div className="px-2 py-3 text-sm text-destructive">
            Unable to load notifications
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            No unread notifications
          </div>
        ) : (
          <DropdownMenuGroup>
            {notifications.slice(0, 5).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => markReadMutation.mutate(notification.id)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {notification.message}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatTime(notification.created_at)}
                </p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator />
        <div className="p-1">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
