"use client"

import { MenuIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/api"
import { clearTokens } from "@/lib/auth"
import { NotificationBell } from "./notification-bell"

type AppHeaderProps = {
  onMenuClick: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Always clear local session even if API logout fails.
    } finally {
      clearTokens()
      router.replace("/login")
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </Button>

        <div>
          <h1 className="text-base font-semibold tracking-tight">WSeek</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Project management workspace
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">Signed in</p>
          <p className="text-xs text-muted-foreground">Session active</p>
        </div>
        <Avatar>
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </header>
  )
}
