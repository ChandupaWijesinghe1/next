# OWASP API Security Top 10 — Security Demo API Review

| Field | Value |
|-------|-------|
| **Application** | security-demo (FastAPI) |
| **Review date** | 2026-06-12 |
| **Reviewer** | Engineering / Security Review |
| **Scope** | All REST endpoints under `/auth` and `/teams` |
| **Overall posture** | **Pass with remediations applied** |

---

## Executive summary

This review assessed the security-demo API against eight OWASP API Security Top 10 (2023) categories. The application demonstrates strong baseline controls: ORM-only database access, bcrypt password hashing, JWT expiry, refresh token rotation with reuse detection, team-scoped authorization, role-based admin checks, and Redis-backed rate limiting on authentication endpoints.

Remediations applied during this review:
- Rate limiting extended to `/auth/refresh` and GitHub OAuth endpoints
- CORS middleware added with configurable allowlist
- Swagger/OpenAPI disabled when `APP_ENV=production`
- Generic 500 error handler added to prevent stack trace leakage in production

---

## 1. Broken Object Level Authorization (BOLA)

### What is this risk?

BOLA occurs when an API exposes object identifiers (e.g. `/teams/5/projects/12`) but fails to verify that the authenticated user is allowed to access **that specific object**. Attackers iterate IDs to read or modify data belonging to other users.

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| `GET /teams` returns only caller's teams | **PASS** | `list_teams_for_user()` joins `team_members` filtered by `user.id` |
| Team-scoped routes require membership | **PASS** | `require_team_member(team_id)` on all `/teams/{team_id}/...` routes |
| Project scoped to team in URL | **PASS** | `get_project()` filters `Project.team_id == team_id` |
| Task scoped to project + team | **PASS** | `get_task()` validates project belongs to team first |
| Cross-team ID guessing blocked | **PASS** | Wrong team + valid project ID → 404 or 403 |
| `POST /teams` (create) | **PASS** | Requires auth; creator auto-added as admin member |

### Endpoint coverage matrix

| Endpoint | Membership check |
|----------|------------------|
| `GET /teams` | Scoped list (user's teams only) |
| `GET /teams/{id}` | `require_team_member` |
| `GET/POST /teams/{id}/projects/...` | `require_team_member` + service-layer `ensure_team_membership` |
| `GET/POST /teams/{id}/projects/.../tasks/...` | Same |
| `GET/POST .../comments` | Same |

### Residual risk

- Resource IDs (`team_id`, `project_id`) are exposed in responses — acceptable when access is properly gated.
- **Recommendation:** Add integration tests that assert non-members always receive 403/404 for every object route.

---

## 2. Broken Authentication

### What is this risk?

Broken authentication covers weak, missing, or improperly validated identity mechanisms — predictable tokens, no expiry, credentials stored in plaintext, or session fixation — allowing attackers to impersonate users.

### Findings

| Control | Status | Evidence |
|---------|--------|----------|
| Password hashing | **PASS** | bcrypt via `passlib` (`core/security.py`) |
| Password never returned in API | **PASS** | `UserRead` schema excludes `password_hash` |
| OAuth-only users blocked from password login | **PASS** | `password_hash is None` check in `authenticate_user` |
| Access token expiry | **PASS** | 30 minutes, enforced by PyJWT `exp` claim |
| Refresh token expiry | **PASS** | 7 days, enforced by PyJWT |
| Refresh token rotation | **PASS** | New refresh token issued on each refresh |
| Reuse detection (compromise) | **PASS** | Used JTIs stored in Redis; reuse invalidates all user tokens |
| Logout blacklists access token JTI | **PASS** | Redis `access:blacklist:{jti}` |
| Generic login failure message | **PASS** | Always `"Invalid credentials"` (no user enumeration) |
| Rate limiting on auth endpoints | **PASS** (after fix) | Login, register, refresh, OAuth — 10 req/min/IP |

### Residual risk

- **Recommendation:** Add rate limiting to `/auth/logout` if abuse observed (lower priority).
- **Recommendation:** Rotate `JWT_SECRET_KEY` with a documented procedure for production.

---

## 3. Broken Object Property Level Authorization

### What is this risk?

This risk arises when APIs expose more object properties than the caller should see or accept properties the caller should not be allowed to set (mass assignment). Example: returning `password_hash` or allowing clients to set `role=admin` in a request body.

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| `password_hash` excluded from responses | **PASS** | `UserRead` has only `id, email, username, full_name` |
| `oauth_id` / `oauth_provider` excluded | **PASS** | Not in any response schema |
| Client cannot set `created_by` | **PASS** | Set server-side in services from `current_user` |
| Client cannot set `role` on self | **PASS** | Role only via admin `POST/PATCH .../members` |
| Client cannot set `owner_id`/`created_by` on tasks | **PASS** | Not in `TaskCreate` schema |
| Pydantic `response_model` on all routes | **PASS** | FastAPI filters extra ORM fields |

### Exposed fields (by design)

| Field | Rationale |
|-------|-----------|
| `id`, `team_id`, `project_id` | Required for REST navigation; access gated by authz |
| `created_by` on teams/projects/tasks/comments | Audit visibility for team members |
| `user_id` on team members | Required for member management |

### Residual risk

- `test_user.py` prints `password_hash` to console in local dev scripts — not an API exposure; avoid in production scripts.

---

## 4. Unrestricted Resource Consumption

### What is this risk?

Without rate limits, pagination, or payload size caps, attackers can exhaust CPU, memory, database connections, or third-party quotas through high-volume or expensive requests.

### Findings

| Control | Status | Evidence |
|---------|--------|----------|
| Rate limit login | **PASS** | Redis sliding window, 10/min/IP |
| Rate limit register | **PASS** | Same |
| Rate limit refresh | **PASS** (fixed) | Added `rate_limit_refresh` |
| Rate limit OAuth | **PASS** (fixed) | Added `rate_limit_oauth` |
| 429 + Retry-After header | **PASS** | `RateLimitExceededError` handler |
| List endpoint pagination | **PARTIAL** | No pagination on `/teams`, projects, tasks — acceptable for demo scale |
| Request body size limits | **PARTIAL** | Pydantic field max lengths exist; no global FastAPI body limit configured |

### Remediation applied

- Extended rate limiting to `POST /auth/refresh`, `GET /auth/oauth/github`, and `GET /auth/oauth/github/callback`.

### Recommendations

- Add pagination (`limit`/`offset`) before production scale.
- Configure reverse-proxy or FastAPI request size limits.

---

## 5. Broken Function Level Authorization

### What is this risk?

Function-level authorization failures allow users to perform **actions** they shouldn't — e.g. a `member` deleting projects or managing team membership when only `admin` should.

### Findings

| Action | Required role | Status |
|--------|---------------|--------|
| Update team settings | Admin | **PASS** — `require_team_admin` |
| Add/remove/update members | Admin | **PASS** |
| Delete project | Admin | **PASS** |
| Update project | Admin | **PASS** |
| Create project/task/comment | Member+ | **PASS** — `require_team_member` |
| Update/delete task | Creator or admin | **PASS** — `require_task_creator_or_admin` |
| Delete comment | Author only | **PASS** — `require_comment_author` |

### Residual risk

- None identified. Role checks exist at both route (dependency) and service layers for team membership.

---

## 6. Server-Side Request Forgery (SSRF)

### What is this risk?

SSRF occurs when an API accepts a URL (or host) from the user and makes a server-side HTTP request to it, potentially reaching internal services, cloud metadata endpoints (`169.254.169.254`), or arbitrary external hosts.

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| User-supplied URL fetching | **PASS** | No endpoint accepts a URL parameter for outbound requests |
| GitHub OAuth HTTP calls | **PASS** | Hardcoded GitHub URLs only (`services/github_oauth_service.py`) |
| Raw SQL / file path from user | **PASS** | Not present |

### Code search result

```
grep httpx.get/post → only github_oauth_service.py with constant GITHUB_*_URL values
grep user URL input   → none
```

**Status: PASS** — No SSRF attack surface identified.

---

## 7. Security Misconfiguration

### What is this risk?

Security misconfiguration includes default credentials, open CORS (`*`), verbose error pages, exposed admin interfaces, unnecessary features enabled in production, and missing security headers.

### Findings

| Check | Before | After review |
|-------|--------|--------------|
| CORS | Not configured (browser default) | **FIXED** — allowlist via `CORS_ORIGINS` |
| Swagger UI in production | Always exposed | **FIXED** — disabled when `APP_ENV=production` |
| Error verbosity | FastAPI default stack traces in dev | **FIXED** — generic 500 in production |
| Custom error handlers | Generic messages for auth errors | **PASS** |
| Secrets in repo | `.env` gitignored, `.env.example` has placeholders | **PASS** |
| HTTPS enforcement | Not in app (deployment concern) | **INFO** — terminate TLS at reverse proxy |
| Security headers (HSTS, CSP) | Not set | **PARTIAL** — add at reverse proxy |

### Remediation applied

```python
# main.py
app = FastAPI(docs_url=None if production else "/docs", ...)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, ...)
```

### Production checklist

- [ ] Set `APP_ENV=production`
- [ ] Set strong `JWT_SECRET_KEY` (32+ random bytes)
- [ ] Restrict `CORS_ORIGINS` to frontend domain only
- [ ] Enable HTTPS at load balancer
- [ ] Do not run with `uvicorn --reload` in production

---

## 8. Injection

### What is this risk?

Injection flaws (SQL, NoSQL, OS, LDAP) occur when untrusted input is sent to an interpreter as part of a command or query. In APIs, SQL injection via string-concatenated queries is the most common form.

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| Raw SQL with string formatting | **PASS** | Zero matches in codebase |
| SQLAlchemy ORM usage | **PASS** | All queries use `.filter()` with bound parameters |
| `text()` / `execute()` with user input | **PASS** | Not used (only Redis pipeline `.execute()`) |
| Pydantic input validation | **PASS** | Email, string length, password complexity |

### Code search performed

```
Pattern: execute(, text(, f"...SELECT", .format(.*sql
Result: No SQL injection vectors found
```

**Status: PASS**

---

## Summary scorecard

| # | Category | Result |
|---|----------|--------|
| 1 | Broken Object Level Authorization | **PASS** |
| 2 | Broken Authentication | **PASS** |
| 3 | Broken Object Property Level Authorization | **PASS** |
| 4 | Unrestricted Resource Consumption | **PASS** (with recommendations) |
| 5 | Broken Function Level Authorization | **PASS** |
| 6 | Server-Side Request Forgery | **PASS** |
| 7 | Security Misconfiguration | **PASS** (after fixes) |
| 8 | Injection | **PASS** |

---

## How to publish this page to Confluence

1. In Confluence, create a new page under your project space.
2. Title: **OWASP API Security Review — security-demo**
3. Click **Insert** → **Markup** → paste this document, or use **Import Word/Markdown** if available.
4. Confluence will render tables and headings automatically.
5. Add labels: `security`, `owasp`, `api-review`, `security-demo`.
6. Link this page from your sprint / internship documentation index.

---

*Document generated from static code analysis and automated security tests against the security-demo FastAPI application.*
