const TEAM_STORAGE_KEY = "wseek_selected_team_id"

export function getSelectedTeamId(): number | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(TEAM_STORAGE_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export function setSelectedTeamId(teamId: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TEAM_STORAGE_KEY, String(teamId))
}

export function clearSelectedTeamId() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TEAM_STORAGE_KEY)
}

