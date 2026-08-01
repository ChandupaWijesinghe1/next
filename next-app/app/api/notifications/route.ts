import { NextRequest, NextResponse } from "next/server"

const NOTIFICATIONS_API_URL =
  process.env.NOTIFICATIONS_URL ??
  process.env.NEXT_PUBLIC_NOTIFICATIONS_URL ??
  "http://127.0.0.1:8001"

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")
  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly")
  const parsedUserId = Number(userId)

  if (!userId || !Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return NextResponse.json({ detail: "Valid userId is required" }, { status: 400 })
  }

  const upstreamParams = new URLSearchParams({
    unread_only: unreadOnly === "false" ? "false" : "true",
  })

  const upstream = await fetch(
    `${NOTIFICATIONS_API_URL.replace(/\/$/, "")}/notifications/${parsedUserId}?${upstreamParams.toString()}`,
    { cache: "no-store" }
  )

  if (!upstream.ok) {
    const detail = await upstream.text()
    return NextResponse.json(
      { detail: detail || "Unable to fetch notifications" },
      { status: upstream.status }
    )
  }

  const data = await upstream.json()
  return NextResponse.json(data)
}
