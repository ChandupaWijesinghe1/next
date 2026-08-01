import { test, expect } from "@playwright/test"

import { authenticatePage } from "./helpers/auth"

// Do not reuse the shared setup token — logout blacklists that JWT server-side.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Logout", () => {
  test("logs out, redirects to login, and blocks protected pages", async ({
    page,
    request,
  }) => {
    await authenticatePage(page, request)

    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText("Signed in")).toBeVisible()

    // No separate user menu in the current UI — Log out is in the top bar.
    await page.getByRole("button", { name: "Log out" }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText("Sign in to WSeek")).toBeVisible()

    await page.goto("/projects")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText("Sign in to WSeek")).toBeVisible()
  })
})
