"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { isAuthenticated } from "@/lib/auth"
import { Skeleton } from "@/components/ui/skeleton"

function LoginPageContent() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/")
    }
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <LoginForm />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6">
          <Skeleton className="h-72 w-full max-w-md" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
