import { test, expect } from "@playwright/test"

import { ensureTeam, uniqueId } from "./helpers/auth"

test.describe("Create project validation", () => {
  test("shows a validation error for invalid project data", async ({
    page,
    request,
  }) => {
    const teamName = uniqueId("team")

    await ensureTeam(page, teamName, request)
    await page.getByRole("button", { name: "New project" }).click()
    await expect(page.getByText("Create project").first()).toBeVisible()

    // Whitespace-only name passes HTML required, then fails API min_length after trim.
    await page.locator("#project-name").fill("   ")
    await page.locator("#project-description").fill("Should fail")
    await page.getByRole("button", { name: "Create project" }).click()

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Create project").first()).toBeVisible()
  })
})
