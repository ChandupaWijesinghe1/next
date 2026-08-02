import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"

import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const API_URL =
  process.env.E2E_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"

export const ACCESS_TOKEN_KEY = "wseek_access_token"
export const REFRESH_TOKEN_KEY = "wseek_refresh_token"
export const AUTH_STATE_PATH = path.join("e2e", ".auth", "user.json")

export type E2EUser = {
  email: string
  username: string
  password: string
  full_name: string
}

export type AuthTokens = {
  access_token: string
  refresh_token: string
}

export function uniqueId(prefix = "e2e") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildUser(overrides: Partial<E2EUser> = {}): E2EUser {
  const id = uniqueId("user")
  return {
    email: `${id}@example.com`,
    username: id.slice(0, 24),
    password: "TestPass1",
    full_name: `Test User ${id}`,
    ...overrides,
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Firefox often fails navigations that race with auth redirects. */
async function safeGoto(page: Page, url: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      })
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const isRetryable =
        /NS_BINDING_ABORTED|NS_ERROR_FAILURE|ERR_ABORTED|frame was detached|Navigation interrupted/i.test(
          message
        )

      if (!isRetryable || attempt === 4) {
        throw error
      }

      await sleep(500 * attempt)
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 })
      } catch {
        // ignore — page may still be recovering from the aborted navigation
      }
    }
  }

  throw lastError
}

/** Retry auth API calls when the backend rate-limits (HTTP 429). */
async function postAuthWithRetry(
  request: APIRequestContext,
  path: string,
  data: Record<string, string>,
  label: string,
  attempts = 5
) {
  let lastStatus = 0
  let lastBody = ""

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await request.post(`${API_URL}${path}`, { data })
    if (response.ok()) {
      return response.json()
    }

    lastStatus = response.status()
    lastBody = await response.text()

    if (lastStatus === 429 && attempt < attempts) {
      // Backend window is 60s; wait and retry with increasing delay.
      await sleep(5_000 * attempt)
      continue
    }

    break
  }

  expect(
    false,
    `${label} failed: ${lastStatus} ${lastBody}`
  ).toBeTruthy()
}

export async function registerUser(
  request: APIRequestContext,
  user: E2EUser
) {
  return postAuthWithRetry(
    request,
    "/auth/register",
    {
      email: user.email,
      username: user.username,
      password: user.password,
      full_name: user.full_name,
    },
    "register"
  )
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<AuthTokens> {
  return postAuthWithRetry(request, "/auth/login", { email, password }, "login") as Promise<AuthTokens>
}

/** Write auth tokens into localStorage on the current origin (call after first navigation). */
export async function setAuthTokensOnPage(page: Page, tokens: AuthTokens) {
  await page.evaluate(
    ({ accessKey, refreshKey, accessToken, refreshToken }) => {
      window.localStorage.setItem(accessKey, accessToken)
      window.localStorage.setItem(refreshKey, refreshToken)
    },
    {
      accessKey: ACCESS_TOKEN_KEY,
      refreshKey: REFRESH_TOKEN_KEY,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }
  )
}

/**
 * Register + login via API (not UI), then seed localStorage once.
 * Avoid addInitScript so logout tests are not re-authenticated on later navigations.
 */
export async function authenticatePage(
  page: Page,
  request: APIRequestContext,
  user: E2EUser = buildUser()
) {
  await registerUser(request, user)
  const tokens = await loginViaApi(request, user.email, user.password)
  await safeGoto(page, "/login")
  await setAuthTokensOnPage(page, tokens)
  return { user, tokens }
}

export async function ensureAuthDir() {
  const authDir = path.join(process.cwd(), "e2e", ".auth")
  await mkdir(authDir, { recursive: true })
  return authDir
}

/** If localStorage auth is missing, reload it from the saved Playwright storage state. */
export async function ensurePageAuth(page: Page) {
  // Prefer /projects: visiting /login while already authed triggers a client redirect
  // that races the next goto on Firefox (NS_BINDING_ABORTED / NS_ERROR_FAILURE).
  await safeGoto(page, "/projects")

  let existing = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    ACCESS_TOKEN_KEY
  )

  if (!existing) {
    const raw = await readFile(AUTH_STATE_PATH, "utf8")
    const state = JSON.parse(raw) as {
      origins: Array<{ localStorage: Array<{ name: string; value: string }> }>
    }
    const items = state.origins[0]?.localStorage ?? []
    expect(items.length, "saved auth storage state is empty").toBeGreaterThan(0)

    await page.evaluate((entries) => {
      for (const entry of entries) {
        window.localStorage.setItem(entry.name, entry.value)
      }
    }, items)

    await safeGoto(page, "/projects")
    existing = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      ACCESS_TOKEN_KEY
    )
  }

  expect(existing, "auth token missing after ensurePageAuth").toBeTruthy()
}

/** Ensure a team exists for the authenticated user. */
export async function ensureTeam(
  page: Page,
  teamName: string,
  _request?: APIRequestContext
) {
  await ensurePageAuth(page)
  // ensurePageAuth already lands on /projects; re-goto only if we left the page.
  if (!page.url().includes("/projects")) {
    await safeGoto(page, "/projects")
  }
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible({
    timeout: 20_000,
  })

  const newProjectButton = page.getByRole("button", { name: "New project" })
  const teamNameInput = page.locator("#team-name")

  await Promise.race([
    newProjectButton.waitFor({ state: "visible", timeout: 20_000 }),
    teamNameInput.waitFor({ state: "visible", timeout: 20_000 }),
  ]).catch(() => undefined)

  if (await newProjectButton.isVisible().catch(() => false)) {
    return
  }

  await expect(teamNameInput).toBeVisible({ timeout: 10_000 })
  await teamNameInput.fill(teamName)
  await page.locator("#team-description").fill(`${teamName} description`)
  await page.getByRole("button", { name: "Create team" }).click()
  await expect(newProjectButton).toBeVisible({ timeout: 20_000 })
}

export async function createProjectViaUi(page: Page, projectName: string) {
  await page.getByRole("button", { name: "New project" }).click()
  await expect(page.getByText("Create project").first()).toBeVisible()
  await page.locator("#project-name").fill(projectName)
  await page.locator("#project-description").fill("E2E project description")
  await page.getByRole("button", { name: "Create project" }).click()
  await expect(page.getByRole("link", { name: projectName })).toBeVisible({
    timeout: 20_000,
  })
}

export async function openProject(page: Page, projectName: string) {
  await page.getByRole("link", { name: projectName }).click()
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible({
    timeout: 20_000,
  })
}
