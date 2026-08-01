import { NextRequest, NextResponse } from "next/server"

const NOTIFICATIONS_API_URL =
  process.env.NOTIFICATIONS_URL ??
  process.env.NEXT_PUBLIC_NOTIFICATIONS_URL ??
  "http://127.0.0.1:8001"

type RouteContext = {
  params: Promise<{
    notificationId: string
  }>
}

export async function PATCH(_: NextRequest, context: RouteContext) {
  const params = await context.params
  const notificationId = Number(params.notificationId)

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return NextResponse.json(
      { detail: "Valid notification id is required" },
      { status: 400 }
    )
  }

  const upstream = await fetch(
    `${NOTIFICATIONS_API_URL.replace(/\/$/, "")}/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      cache: "no-store",
    }
  )

  if (!upstream.ok) {
    const detail = await upstream.text()
    return NextResponse.json(
      { detail: detail || "Unable to update notification" },
      { status: upstream.status }
    )
  }

  const data = await upstream.json()
  return NextResponse.json(data)
}
