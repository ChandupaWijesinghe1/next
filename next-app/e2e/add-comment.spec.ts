import { test, expect } from "@playwright/test"

import {
  createProjectViaUi,
  ensureTeam,
  openProject,
  uniqueId,
} from "./helpers/auth"

test.describe("Add comment", () => {
  test("posts a comment on a task and shows it in the comments section", async ({
    page,
    request,
  }) => {
    const teamName = uniqueId("team")
    const projectName = uniqueId("project")
    const taskTitle = uniqueId("task")
    const commentBody = `Comment ${uniqueId("cmt")}`

    await ensureTeam(page, teamName, request)
    await createProjectViaUi(page, projectName)
    await openProject(page, projectName)

    await page.getByRole("button", { name: "New task" }).click()
    await page.locator("#task-title").fill(taskTitle)
    await page.getByRole("button", { name: "Create task" }).click()
    await expect(
      page.getByRole("row").filter({ hasText: taskTitle })
    ).toBeVisible({ timeout: 20_000 })

    await expect(
      page.getByRole("heading", { name: "Comments & attachments" })
    ).toBeVisible()
    await page.locator("#project-comment").fill(commentBody)
    await page.getByRole("button", { name: "Post comment" }).click()

    await expect(page.getByText(commentBody)).toBeVisible({ timeout: 20_000 })
  })
})
