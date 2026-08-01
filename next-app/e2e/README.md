# Playwright E2E

End-to-end tests for critical WSeek flows.

## Prerequisites (local)

1. Backend API running at `http://127.0.0.1:8000` (security-demo) + Redis.
2. From `next-app`, dependencies installed (`npm install`).
3. Browsers installed once:

```powershell
npx playwright install chromium firefox
```

## Run tests locally

```powershell
cd D:\INTERN\wseek-9\next\next-app
npm run test:e2e
```

Playwright starts the Next.js app on `http://127.0.0.1:3000` automatically.

Useful commands:

```powershell
npm run test:e2e:ui
npm run test:e2e:report
npx playwright test e2e/login.spec.ts
```

## CI Integration (GitHub Actions)

Workflow files:

- `next-app/.github/workflows/e2e.yml` — used when git root is `next-app`
- `../.github/workflows/e2e.yml` — used when git root is the monorepo `next/` (recommended)

### What CI does on every push / PR

1. Checkout code
2. Install Node + Python deps
3. Install Playwright browsers (Chromium + Firefox)
4. Build the Next.js app (`npm run build`)
5. Start Redis (service container)
6. Start security-demo API on `:8000` and wait until ready
7. Start Next.js production server (`npm run start`) on `:3000` and wait until ready
8. Run Playwright E2E tests
9. Upload `playwright-report` + `test-results` artifacts

### Recommended setup (monorepo)

Your E2E tests need both `next-app` and `security-demo`. Prefer making `D:\INTERN\wseek-9\next` the git root:

```powershell
cd D:\INTERN\wseek-9\next
# if git currently lives only in next-app, move it up (careful — backup first)
# then commit .github/workflows/e2e.yml + next-app + security-demo
git add .github next-app security-demo
git commit -m "Add CI E2E workflow"
git push
```

### If git root stays `next-app`

CI can still run the Next.js build/start/Playwright steps, but it must find `security-demo` either:

- as `security-demo/` inside the same repo, or
- as a sibling folder in the checkout

Otherwise the workflow fails with a clear “backend not found” error.

## What is covered

- Auth setup via API + saved storage state (`e2e/auth.setup.ts`)
- Signup, login, logout
- Create project (+ invalid project negative case)
- Create task, add comment, update task status
- Chromium and Firefox projects
- Screenshot on failure

## Notes

- There is no task **priority** field in the UI; task tests cover title + assignee.
- Logout uses a throwaway API-authenticated user so it does not blacklist the shared setup JWT.
- Auth helpers retry on HTTP 429 (login rate limit).
