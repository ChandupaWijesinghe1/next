import { ApiError } from "@/lib/api"

export function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}
