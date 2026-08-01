import { test, expect } from "@playwright/test"

import {
  createProjectViaUi,
  ensureTeam,
  openProject,
  uniqueId,
} from "./helpers/auth"

test.describe("Update task status", () => {
  test("changes status and persists after reload", async ({ page, request }) => {
    const teamName = uniqueId("team")
    const projectName = uniqueId("project")
    const taskTitle = uniqueId("task")

    await ensureTeam(page, teamName, request)
    await createProjectViaUi(page, projectName)
    await openProject(page, projectName)

    await page.getByRole("button", { name: "New task" }).click()
    await page.locator("#task-title").fill(taskTitle)
    await page.getByRole("button", { name: "Create task" }).click()
    await expect(
      page.getByRole("row").filter({ hasText: taskTitle })
    ).toBeVisible({ timeout: 20_000 })

    const statusSelect = page.getByLabel(`Status for ${taskTitle}`)
    await statusSelect.selectOption("in_progress")
    await expect(statusSelect).toHaveValue("in_progress")

    await page.reload()
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel(`Status for ${taskTitle}`)).toHaveValue(
      "in_progress"
    )
  })
})
