# Production Quality Audit — Design Doc

**Goal:** Bring the ProjectTracker codebase to production-grade quality following Next.js best practices and SOLID principles. Targets both the bank client delivery and SaaS foundation.

**Scope:** Moderate refactoring — fix security/data integrity, extract shared helpers and constants, add missing infrastructure (tests, error boundaries, loading states, indexes). No full service/repository layer.

**Approach:** Foundation-first (Approach B) — extract shared code first so subsequent fixes are cleaner, then data integrity, security, tests, and polish.

---

## Section 1: DRY Extraction — Shared Helpers & Constants

### 1a. `src/lib/api-utils.ts`
Extract `getSessionAndMembership` (duplicated across 19 route files) into a single shared helper. All routes import from here.

### 1b. `src/lib/task-constants.ts`
Single source of truth for:
- Status values (`"todo"`, `"in_progress"`, `"in_review"`, `"done"`) as const
- Priority display config (labels + color classes)
- Type display config (labels + icons)
- Status display config (labels + colors)
- Column limits (`MAX_COLUMNS = 6`, `MIN_COLUMNS = 4`)
- `statusFromColumnName()` — centralized mapping function (currently duplicated in 2 routes)

### 1c. `src/lib/env.ts`
Startup environment validation using Zod. Validates:
- `DATABASE_URL` (required)
- `NEXTAUTH_SECRET` (required, not equal to example value)
- `NEXTAUTH_URL` (required)

Fails fast with clear error messages instead of cryptic Prisma connection errors.

---

## Section 2: Data Integrity Fixes

### 2a. Fix status inconsistency in seed
`prisma/seed.ts` uses hyphens (`"in-review"`, `"in-progress"`) while all app code uses underscores (`"in_review"`, `"in_progress"`). Fix seed to match constants from 1b.

### 2b. Add `statusKey` to Column model
Store explicit `statusKey` on each column instead of deriving task status from column name string-matching (`colName.includes("progress")`). When tasks move between columns, read `column.statusKey` directly.

### 2c. Convert status fields to Prisma enums
Replace `Task.status` (raw String) and `Project.status` (raw String) with proper Prisma enums. DB enforces valid values, prevents typos and bad data.

### 2d. Add composite indexes
- `Task: @@index([projectId, status])` — dashboard counts
- `Task: @@index([columnId, position])` — drag-and-drop reorder
- `Board: @@index([projectId])` — board loading

---

## Section 3: Security Fixes

### 3a. JWT hardening
- Set `session.maxAge` to 8 hours (banking context)
- Refresh `role` from DB in JWT callback so role demotions take effect immediately

### 3b. Remove SVG from allowed uploads
SVGs rendered via direct blob URLs can execute embedded JavaScript. Remove `"svg"` from `ALLOWED_EXTENSIONS` in attachment and comment upload routes.

### 3c. Fix comment deletion blob leak
Replace hardcoded local `unlink` in `comments/[commentId]/route.ts` with `deleteFromBlob()` (matching standalone attachment deletion). Currently production blob files leak on comment deletion.

### 3d. Security headers in `next.config.ts`
Add `headers()` for `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### 3e. Strengthen password minimum
Bump `createUserSchema` password min from 6 to 8 characters.

### 3f. API admin routes in middleware
Add `"/api/admin/:path*"` to middleware matcher for edge-level auth protection as defense-in-depth.

### Deferred
- Rate limiting (needs Redis/in-memory store) — follow-up item

---

## Section 4: Tests

### 4a. Vitest config
Create `vitest.config.ts` with React plugin, path aliases, jsdom environment.

### 4b. Unit tests
- `task-constants.ts` — `statusFromColumnName()` mapping
- `src/lib/reports.ts` — Extract `computeBurndown`, `computeVelocity`, `computeDistribution` from `reports/page.tsx` into testable module, test with known inputs/outputs
- `src/lib/env.ts` — validation rejects missing/invalid vars

### 4c. API route integration tests (mocked Prisma)
- `POST /api/projects/[id]/tasks` — task creation sets correct status
- `POST /api/projects/[id]/tasks/reorder` — position reordering
- `PATCH /api/projects/[id]/board/columns` — column CRUD

### 4d. Component test
- `TaskCard` — render with known props, verify priority badge, progress bar, counts

### Deferred
- Playwright E2E tests — follow-up item

---

## Section 5: Error/Loading Boundaries & Polish

### 5a. `loading.tsx` files
Skeleton loaders for:
- `(authenticated)/dashboard/loading.tsx` — KPI + project card skeletons
- `(authenticated)/projects/[id]/board/loading.tsx` — column skeletons
- `(authenticated)/projects/[id]/backlog/loading.tsx` — table skeleton

### 5b. `error.tsx`
Branded error boundary at `(authenticated)/` route group level. Friendly "Something went wrong" with retry button.

### 5c. `not-found.tsx`
Custom 404 at app root with link back to dashboard.

### 5d. Split BacklogTable (~930 lines)
- `useBacklogData` hook — data fetching, filtering state, pagination, mutations
- `BacklogFilters` component — filter bar
- `BacklogTable` — pure table rendering (~300-400 lines each)

### 5e. Move TaskDetailDialog
From `src/components/board/` to `src/components/shared/` (used by board, backlog, sprints).

### 5f. Switch to Prisma Migrate
1. Baseline current schema: `npx prisma migrate dev --name init`
2. Change build script from `prisma db push` to `prisma migrate deploy`
3. All future schema changes go through `prisma migrate dev --name description`

---

## Out of Scope (Follow-ups)
- Full service/repository layer
- Rate limiting on login and API endpoints
- Playwright E2E tests
- React Query / SWR for granular board cache invalidation
- `next/image` migration for user-uploaded attachments
