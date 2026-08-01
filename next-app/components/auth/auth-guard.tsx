"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { isAuthenticated } from "@/lib/auth"
import { Skeleton } from "@/components/ui/skeleton"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      const next = encodeURIComponent(pathname || "/")
      router.replace(`/login?next=${next}`)
      return
    }

    setReady(true)
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
