import { test, expect } from "@playwright/test"

import {
  createProjectViaUi,
  ensureTeam,
  uniqueId,
} from "./helpers/auth"

test.describe("Create project", () => {
  test("creates a project and shows it in the list", async ({ page, request }) => {
    const teamName = uniqueId("team")
    const projectName = uniqueId("project")

    await ensureTeam(page, teamName, request)
    await createProjectViaUi(page, projectName)

    await expect(page.getByRole("link", { name: projectName })).toBeVisible()
  })
})
