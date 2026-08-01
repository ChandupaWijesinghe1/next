import { test, expect } from "@playwright/test"

import { buildUser, registerUser } from "./helpers/auth"

test.describe("Login", () => {
  test("enters credentials, submits, and shows dashboard user info", async ({
    page,
    request,
  }) => {
    const user = buildUser()
    await registerUser(request, user)

    await page.goto("/login")
    await expect(page.getByText("Sign in to WSeek")).toBeVisible()

    await page.locator("#email").fill(user.email)
    await page.locator("#password").fill(user.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText("Signed in")).toBeVisible()
    await expect(page.getByText("Session active")).toBeVisible()
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible()
  })
})
