import { test, expect } from "@playwright/test"

import {
  createProjectViaUi,
  ensureTeam,
  openProject,
  uniqueId,
} from "./helpers/auth"

test.describe("Create task", () => {
  test("creates a task with title and assignee and shows it in the list", async ({
    page,
    request,
  }) => {
    const teamName = uniqueId("team")
    const projectName = uniqueId("project")
    const taskTitle = uniqueId("task")

    await ensureTeam(page, teamName, request)
    await createProjectViaUi(page, projectName)
    await openProject(page, projectName)

    await page.getByRole("button", { name: "New task" }).click()
    await expect(page.getByText("Create task").first()).toBeVisible()

    await page.locator("#task-title").fill(taskTitle)
    await page.locator("#task-description").fill("E2E task details")

    // App has no priority field; assignee is the available assignment control.
    const assignee = page.locator("#task-assignee")
    await expect(assignee).toBeVisible()
    const optionCount = await assignee.locator("option").count()
    if (optionCount > 1) {
      await assignee.selectOption({ index: 1 })
    }

    await page.getByRole("button", { name: "Create task" }).click()
    await expect(
      page.getByRole("row").filter({ hasText: taskTitle })
    ).toBeVisible({ timeout: 20_000 })
  })
})
