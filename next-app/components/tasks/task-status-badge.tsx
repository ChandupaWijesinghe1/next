import { Badge } from "@/components/ui/badge"

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
}

const STATUS_VARIANTS: Record<
  string,
  "outline" | "secondary" | "default"
> = {
  todo: "outline",
  in_progress: "secondary",
  done: "default",
}

export function TaskStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status
  const variant = STATUS_VARIANTS[status] ?? "outline"

  return <Badge variant={variant}>{label}</Badge>
}
