"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { SignupForm } from "@/components/auth/signup-form"
import { isAuthenticated } from "@/lib/auth"

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/")
    }
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <SignupForm />
    </div>
  )
}
