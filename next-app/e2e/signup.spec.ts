import { test, expect } from "@playwright/test"

import { buildUser, loginViaApi } from "./helpers/auth"

test.describe("Signup", () => {
  test("fills the form, submits, redirects, and can log in again", async ({
    page,
    request,
  }) => {
    const user = buildUser()

    await page.goto("/signup")
    await expect(page.getByText("Create your WSeek account")).toBeVisible()

    await page.locator("#full_name").fill(user.full_name)
    await page.locator("#username").fill(user.username)
    await page.locator("#email").fill(user.email)
    await page.locator("#password").fill(user.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText("Signed in")).toBeVisible()

    // Clear session and confirm the new account can log in via UI.
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await page.goto("/login")
    await page.locator("#email").fill(user.email)
    await page.locator("#password").fill(user.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText("Signed in")).toBeVisible()

    const tokens = await loginViaApi(request, user.email, user.password)
    expect(tokens.access_token).toBeTruthy()
  })
})
