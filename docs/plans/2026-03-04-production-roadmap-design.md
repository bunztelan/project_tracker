# ProjectTracker Production Roadmap

**Date**: 2026-03-04
**Status**: Approved
**Approach**: Phased delivery — essentials first, extras only if requested

## Context

ProjectTracker is a working prototype delivered to a banking client for evaluation. If approved, the prototype needs to be productionized for deployment. The bank has 5-15 users. Deployment target is unknown (on-prem or cloud), so Docker must support both.

Timeline: 1-2 months. Phase 1 delivers in 4 weeks. Phase 2 only if the bank requests it.

## Phase 1: Production Essentials (Week 1-4)

### 1. Docker & Deployment (Week 1)

- `Dockerfile` — multi-stage build (deps, build, production slim image)
- `docker-compose.yml` — app + PostgreSQL + persistent volumes for DB data and uploads
- `docker-compose.prod.yml` — production overrides (no exposed DB port, restart policies)
- `.env.example` — documented environment variables with safe defaults
- Startup script that runs Prisma migrations + optional seed on first boot
- No nginx/reverse proxy — bank's infra team provides their own. Expose port 3000.

Architecture:
- app container (Next.js, port 3000)
- db container (PostgreSQL 16, internal only)
- volumes: postgres_data (persistent), uploads (persistent)

### 2. Environment & Security Hardening (Week 1-2)

**Environment:**
- Remove hardcoded NEXTAUTH_SECRET — fail to start if missing
- Generate random admin password on first boot (printed to console)
- Validate all required env vars at startup with clear error messages

**Security:**
- Input validation audit — ensure all API routes validate with Zod
- Rate limiting on /api/auth (login endpoint)
- CSRF protection review
- Sanitize file upload names, enforce mime type + size limits
- Remove console.log with sensitive data
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.) via next.config.js
- Verify authentication + authorization consistency across all API routes

**Not in Phase 1:** SSO/LDAP, audit logging, IP allowlisting, penetration testing.

### 3. Testing (Week 2-3)

Target ~40-50% coverage. No E2E.

**API route tests (Vitest):**
- Authentication flow (login, session, unauthorized access)
- Task CRUD (create, read, update, delete, reorder)
- Project CRUD + member management
- Sprint CRUD
- File upload + attachment API
- Comments CRUD
- Role-based access (admin vs manager vs member)

**Component tests (Vitest + React Testing Library):**
- Kanban board (drag & drop, column management)
- Task detail dialog (edit fields, add comment, attach file)
- Login form (validation, submit)
- Sprint planning (assign/unassign tasks)

### 4. Documentation (Week 3-4)

**Deployment guide** (docs/deployment.md):
- Prerequisites, step-by-step setup, env var reference
- Backup & restore (pg_dump/pg_restore)
- Updating to new version
- Troubleshooting

**User guide** (docs/user-guide.md):
- Getting started, feature walkthrough with screenshots
- Role permissions explained
- Concise — 5-15 users, not a 200-page manual

**Admin guide** (docs/admin-guide.md):
- User management, feature toggles, database access

No API documentation unless explicitly requested.

### 5. Cleanup & Polish (Week 4)

- Remove/replace seed data defaults
- Clean up TODO/FIXME/HACK comments
- Consistent error handling across API routes
- Loading states and empty states for all pages
- Mobile responsiveness check
- Favicon and branding cleanup (white-labelable or client branding)

## Phase 2: Extended Production (Week 5-8, only if requested)

Each item is independently scoped and quoted separately.

| Item | Effort | Trigger |
|---|---|---|
| Audit logging | 1 week | Bank compliance team asks |
| SSO/LDAP integration | 1-2 weeks | Bank IT wants single sign-on |
| S3-compatible file storage | 3-4 days | >50 attachments or multi-server deploy |
| E2E tests (Playwright) | 1 week | Bank requires test evidence |
| CI/CD pipeline (GitHub Actions) | 2-3 days | Bank wants automated build/test/deploy |
| API documentation (OpenAPI) | 3-4 days | Bank wants integrations |
| Performance optimization + caching | 1 week | Slowness at scale |
| Monitoring & health checks | 2-3 days | Ops team requires it |

## Constraints

- Deployment target unknown — Docker must work for both on-prem and cloud
- No specific compliance requirements mentioned yet
- AI-assisted development (Claude Code) — factor into timeline estimates
- Budget-conscious: don't over-build before confirmation
