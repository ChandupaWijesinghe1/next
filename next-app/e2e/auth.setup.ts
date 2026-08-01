import { test as setup, expect } from "@playwright/test"

import {
  ACCESS_TOKEN_KEY,
  AUTH_STATE_PATH,
  REFRESH_TOKEN_KEY,
  buildUser,
  ensureAuthDir,
  loginViaApi,
  registerUser,
} from "./helpers/auth"

setup("authenticate via API and save storage state", async ({ page, request }) => {
  await ensureAuthDir()

  const user = buildUser({
    email: `setup_${Date.now()}@example.com`,
    username: `setup_${Date.now()}`.slice(0, 24),
  })

  await registerUser(request, user)
  const tokens = await loginViaApi(request, user.email, user.password)

  // Open any same-origin page, then inject tokens via API login (not UI).
  await page.goto("/login")
  await expect(page.getByText("Sign in to WSeek")).toBeVisible()
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

  const storedAccess = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    ACCESS_TOKEN_KEY
  )
  expect(storedAccess).toBe(tokens.access_token)

  await page.context().storageState({ path: AUTH_STATE_PATH })
})
