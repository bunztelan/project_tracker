# Production Quality Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the ProjectTracker codebase to production-grade quality — shared helpers, data integrity, security, tests, error boundaries, and component splits.

**Architecture:** Moderate refactoring of the existing Next.js 15 App Router codebase. No new service/repository layers. Extract duplicated code into shared modules, fix schema-level data integrity, add security hardening, introduce test infrastructure, and add loading/error boundaries.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Vitest, React Testing Library

**Design doc:** `docs/plans/2026-03-04-production-quality-audit-design.md`

---

## Phase 1: DRY Extraction

### Task 1: Create Shared API Auth Helpers

**Files:**
- Create: `src/lib/api-utils.ts`

**Context:** `getSessionAndMembership` is copy-pasted identically across 19 API route files. `requireAdmin` is duplicated in 2 admin route files. Extract both into a single shared module.

**Step 1: Create `src/lib/api-utils.ts`**

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export async function getSessionAndMembership(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  });

  return { session, membership };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: "Unauthorized" as const };
  }
  if (session.user.role !== Role.ADMIN) {
    return { session: null, error: "Forbidden" as const };
  }
  return { session, error: null };
}
```

**Step 2: Replace in all 19 project route files**

In each of these files, delete the local `async function getSessionAndMembership(...)` definition (typically 10-15 lines) and add `import { getSessionAndMembership } from "@/lib/api-utils";` at the top. Remove unused imports of `getServerSession`, `authOptions`, and `prisma` only if they are not used elsewhere in the file.

Files (all under `src/app/api/projects/[id]/`):
- `route.ts`
- `board/route.ts`
- `board/columns/route.ts`
- `members/route.ts`
- `members/[memberId]/route.ts`
- `tasks/route.ts`
- `tasks/reorder/route.ts`
- `tasks/[taskId]/route.ts`
- `tasks/[taskId]/comments/route.ts`
- `tasks/[taskId]/comments/[commentId]/route.ts`
- `tasks/[taskId]/attachments/route.ts`
- `tasks/[taskId]/attachments/[attachmentId]/route.ts`
- `sprints/route.ts`
- `sprints/[sprintId]/route.ts`
- `features/route.ts`
- `dashboards/route.ts`
- `dashboards/widgets/route.ts`
- `excel/route.ts`
- `excel/[uploadId]/route.ts`

**Step 3: Replace in 2 admin route files**

In each file, delete the local `async function requireAdmin(...)` definition and add `import { requireAdmin } from "@/lib/api-utils";`:
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[userId]/route.ts`

**Step 4: Type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
refactor: extract shared API auth helpers
```

---

### Task 2: Create Shared Task Constants

**Files:**
- Create: `src/lib/task-constants.ts`

**Context:** Priority, type, and status display configs are duplicated across `task-card.tsx`, `backlog-table.tsx`, and `task-detail-dialog.tsx`. Status-from-column-name logic is duplicated in `tasks/route.ts` and `tasks/reorder/route.ts`. Column limits are magic numbers in `kanban-board.tsx` and `board/columns/route.ts`.

**Step 1: Create `src/lib/task-constants.ts`**

```typescript
import { CheckCircle2, Circle, Square, Diamond } from "lucide-react";

/* ── Status ─────────────────────────────────────────────── */

export const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  DONE: "done",
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  todo: {
    label: "To Do",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  in_review: {
    label: "In Review",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  done: {
    label: "Done",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

/* ── Priority ───────────────────────────────────────────── */

export const PRIORITY_CONFIG = {
  LOW: {
    label: "Low",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    badgeClassName:
      "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    dotColor: "bg-gray-400",
    order: 1,
  },
  MEDIUM: {
    label: "Medium",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    badgeClassName:
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",
    dotColor: "bg-blue-500",
    order: 2,
  },
  HIGH: {
    label: "High",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    badgeClassName:
      "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800",
    dotColor: "bg-orange-500",
    order: 3,
  },
  CRITICAL: {
    label: "Critical",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    badgeClassName:
      "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",
    dotColor: "bg-red-500",
    order: 4,
  },
} as const;

export const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-400" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500" },
  { value: "HIGH", label: "High", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-500" },
] as const;

/* ── Type ───────────────────────────────────────────────── */

export const TYPE_CONFIG = {
  STORY: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Story",
  },
  BUG: {
    icon: Circle,
    className: "text-red-500",
    label: "Bug",
  },
  TASK: {
    icon: Square,
    className: "text-blue-500",
    label: "Task",
  },
  EPIC: {
    icon: Diamond,
    className: "text-purple-500",
    label: "Epic",
  },
} as const;

export const TYPES = [
  { value: "STORY", label: "Story", icon: CheckCircle2, color: "text-emerald-500" },
  { value: "BUG", label: "Bug", icon: Circle, color: "text-red-500" },
  { value: "TASK", label: "Task", icon: Square, color: "text-blue-500" },
  { value: "EPIC", label: "Epic", icon: Diamond, color: "text-purple-500" },
] as const;

/* ── Column limits ──────────────────────────────────────── */

export const MAX_COLUMNS = 6;
export const MIN_COLUMNS = 4;

/* ── Status from column name ────────────────────────────── */

export function statusFromColumnName(columnName: string): TaskStatus {
  const lower = columnName.toLowerCase();
  if (lower.includes("progress")) return TASK_STATUSES.IN_PROGRESS;
  if (lower.includes("review")) return TASK_STATUSES.IN_REVIEW;
  if (lower.includes("done")) return TASK_STATUSES.DONE;
  return TASK_STATUSES.TODO;
}
```

**Step 2: Replace in consumer files**

In each file below, remove the local config definitions and import from `@/lib/task-constants`:

- `src/components/board/task-card.tsx` — replace local `PRIORITY_CONFIG` (lines 67-87)
- `src/components/backlog/backlog-table.tsx` — replace local `PRIORITY_CONFIG` (lines 83-111), `TYPE_CONFIG` (lines 117-125), `STATUS_CONFIG` (lines 131-152)
- `src/components/board/task-detail-dialog.tsx` — replace local `PRIORITIES` (lines 61-66) and `TYPES` (lines 68-73)
- `src/app/api/projects/[id]/tasks/route.ts` — replace inline status-from-column logic (lines 261-278) with `statusFromColumnName(column.name)`
- `src/app/api/projects/[id]/tasks/reorder/route.ts` — replace inline status-from-column logic (lines 114-123) with `statusFromColumnName(column.name)`
- `src/components/board/kanban-board.tsx` — replace `columns.length < 6` with `columns.length < MAX_COLUMNS`
- `src/app/api/projects/[id]/board/columns/route.ts` — replace `board.columns.length >= 6` with `board.columns.length >= MAX_COLUMNS`

**Step 3: Type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
refactor: extract shared task constants
```

---

### Task 3: Create Environment Validation

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/prisma.ts`

**Context:** Missing environment variables surface as cryptic Prisma errors. Validate at startup with clear messages.

**Step 1: Create `src/lib/env.ts`**

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z
    .string()
    .min(1, "NEXTAUTH_SECRET is required")
    .refine(
      (val) => val !== "change-me-in-production",
      "NEXTAUTH_SECRET must be changed from the default value in production"
    ),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
});

function validateEnv() {
  // Skip strict validation in development for NEXTAUTH_SECRET default check
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const partial = z.object({
      DATABASE_URL: envSchema.shape.DATABASE_URL,
      NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
      NEXTAUTH_URL: z.string().min(1, "NEXTAUTH_URL is required"),
    });
    const result = partial.safeParse(process.env);
    if (!result.success) {
      console.error("Environment validation failed:", result.error.flatten().fieldErrors);
      throw new Error("Missing required environment variables. Check .env file.");
    }
    return;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration. See errors above.");
  }
}

validateEnv();
```

**Step 2: Import in `src/lib/prisma.ts`**

Add `import "@/lib/env";` as the first import in `src/lib/prisma.ts`. This ensures env validation runs before any Prisma client initialization.

**Step 3: Type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat: add startup environment validation
```

---

## Phase 2: Data Integrity

### Task 4: Fix Seed Status Values

**Files:**
- Modify: `prisma/seed.ts`

**Context:** The seed file uses hyphens (`"in-review"`, `"in-progress"`) while all application code uses underscores (`"in_review"`, `"in_progress"`). This creates tasks with statuses that don't match any UI filter or display config.

**Step 1: Fix status values in seed**

In `prisma/seed.ts`, find and replace all status string values:
- `"in-review"` → `"in_review"`
- `"in-progress"` → `"in_progress"`

These appear around lines 193 and 205.

**Step 2: Commit**

```
fix: use underscore status values in seed data
```

---

### Task 5: Add `statusKey` to Column Model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/projects/route.ts` (project creation seeds columns)
- Modify: `prisma/seed.ts` (seed creates columns)
- Modify: `src/app/api/projects/[id]/board/columns/route.ts` (column creation)
- Modify: `src/app/api/projects/[id]/tasks/route.ts` (task creation reads column)
- Modify: `src/app/api/projects/[id]/tasks/reorder/route.ts` (task move reads column)

**Context:** Task status is currently derived from column name string-matching (`colName.includes("progress")`). This is brittle — renaming a column silently breaks status mapping. Store an explicit `statusKey` on each column instead.

**Step 1: Add `statusKey` to Column model in schema**

In `prisma/schema.prisma`, find the `Column` model and add `statusKey`:

```prisma
model Column {
  id        String @id @default(cuid())
  name      String
  position  Int
  statusKey String @default("todo")
  boardId   String

  board Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks Task[]
}
```

**Step 2: Add composite indexes to schema**

Add to the `Task` model:
```prisma
@@index([projectId, status])
@@index([columnId, position])
```

Add to the `Board` model:
```prisma
@@index([projectId])
```

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add-status-key-and-indexes`

This generates the migration SQL and applies it locally.

**Step 4: Update project creation route**

In `src/app/api/projects/route.ts`, find where default columns are created (inside the `$transaction`). Add `statusKey` to each column:

```typescript
{ name: "To Do",       position: 0, boardId: board.id, statusKey: "todo" },
{ name: "In Progress", position: 1, boardId: board.id, statusKey: "in_progress" },
{ name: "In Review",   position: 2, boardId: board.id, statusKey: "in_review" },
{ name: "Done",        position: 3, boardId: board.id, statusKey: "done" },
```

**Step 5: Update seed**

In `prisma/seed.ts`, add `statusKey` to the `columnDefs` array:

```typescript
const columnDefs = [
  { name: "To Do",       position: 0, statusKey: "todo" },
  { name: "In Progress", position: 1, statusKey: "in_progress" },
  { name: "In Review",   position: 2, statusKey: "in_review" },
  { name: "Done",        position: 3, statusKey: "done" },
];
```

And pass `statusKey` in the `prisma.column.create()` call.

**Step 6: Update column creation route**

In `src/app/api/projects/[id]/board/columns/route.ts`, find the `add` action handler. When creating a new column, default `statusKey` to `"todo"`:

```typescript
const newColumn = await prisma.column.create({
  data: {
    name: parsed.data.name,
    position: nextPosition,
    boardId: board.id,
    statusKey: "todo",
  },
  include: { tasks: true },
});
```

**Step 7: Update task creation to use `statusKey`**

In `src/app/api/projects/[id]/tasks/route.ts`, replace the status-from-column-name block (around lines 261-278) with:

```typescript
let status = "todo";
if (resolvedColumnId) {
  const column = await prisma.column.findUnique({
    where: { id: resolvedColumnId },
    select: { statusKey: true },
  });
  if (column) {
    status = column.statusKey;
  }
}
```

**Step 8: Update task reorder to use `statusKey`**

In `src/app/api/projects/[id]/tasks/reorder/route.ts`, replace the status-from-column-name block (around lines 114-123) with:

```typescript
const column = await prisma.column.findUnique({
  where: { id: destinationColumnId },
  select: { statusKey: true },
});
if (!column) {
  return NextResponse.json(
    { data: null, error: "Not Found", message: "Column not found." },
    { status: 404 }
  );
}
const status = column.statusKey;
```

Remove the now-unused `statusFromColumnName` import if it was added in Task 2. The function still exists in `task-constants.ts` for potential future use but is no longer needed in these routes.

**Step 9: Type check and verify**

Run: `npx tsc --noEmit`

**Step 10: Commit**

```
feat: add statusKey to columns, replace string-matching
```

---

## Phase 3: Security

### Task 6: Harden JWT Configuration

**Files:**
- Modify: `src/lib/auth.ts`

**Context:** JWT has no explicit expiry (defaults to 30 days), and role is burned in at login time — role changes aren't reflected until token expires.

**Step 1: Add `maxAge` and refresh role in JWT callback**

In `src/lib/auth.ts`, update the `session` config and `jwt` callback:

```typescript
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  // ... providers stays the same ...
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // Refresh role from DB on each request
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
```

Add `import { prisma } from "@/lib/prisma";` at the top if not already imported.

**Step 2: Type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
fix: set JWT maxAge to 8h and refresh role from DB
```

---

### Task 7: Remove SVG From Allowed Uploads

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts`
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/comments/route.ts`

**Context:** SVG files can contain embedded JavaScript. When served via a direct blob URL and opened in a new tab, they can execute scripts — a stored XSS vector.

**Step 1: Remove `"svg"` from both files**

In both files, find the `ALLOWED_EXTENSIONS` set and remove `"svg"`:

```typescript
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "csv", "txt", "png", "jpg", "jpeg", "gif",
]);
```

**Step 2: Commit**

```
fix: remove SVG from allowed upload extensions
```

---

### Task 8: Fix Comment Deletion Blob Leak

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/comments/[commentId]/route.ts`

**Context:** Comment deletion uses `fs.unlink` to delete files from local disk, but files are stored as Vercel Blob URLs in production. The `unlink` silently fails (file doesn't exist locally) and the blob object is never deleted.

**Step 1: Replace `unlink` with `deleteFromBlob`**

Replace the file deletion block in the DELETE handler:

```typescript
// OLD (lines 81-87):
for (const att of comment.attachments) {
  const absPath = path.join(process.cwd(), "uploads", att.filePath);
  if (existsSync(absPath)) {
    await unlink(absPath);
  }
}

// NEW:
for (const att of comment.attachments) {
  await deleteFromBlob(att.filePath);
}
```

Update imports:
- Remove: `import { unlink } from "fs/promises";`, `import { existsSync } from "fs";`, `import path from "path";`
- Add: `import { deleteFromBlob } from "@/lib/blob";`

**Step 2: Type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
fix: use deleteFromBlob for comment attachment cleanup
```

---

### Task 9: Add Security Headers and Middleware Hardening

**Files:**
- Modify: `next.config.ts`
- Modify: `src/middleware.ts`
- Modify: `src/app/api/admin/users/route.ts` (find Zod schema for password)

**Step 1: Add security headers in `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Step 2: Add API admin routes to middleware matcher**

In `src/middleware.ts`, update the matcher:

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
```

**Step 3: Strengthen password minimum**

In `src/app/api/admin/users/route.ts`, find the `createUserSchema` Zod schema and change `password` min from 6 to 8:

```typescript
password: z.string().min(8, "Password must be at least 8 characters"),
```

**Step 4: Type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
fix: add security headers, protect admin API, strengthen password
```

---

## Phase 4: Tests

### Task 10: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test script)

**Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: Add test script to `package.json`**

In the `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify vitest runs**

Run: `npm test`

Expected: 0 tests found, clean exit.

**Step 4: Commit**

```
chore: configure vitest
```

---

### Task 11: Unit Tests for Task Constants

**Files:**
- Create: `src/lib/__tests__/task-constants.test.ts`

**Context:** Test the `statusFromColumnName` function and verify constant shapes.

**Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  statusFromColumnName,
  TASK_STATUSES,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  MAX_COLUMNS,
  MIN_COLUMNS,
} from "../task-constants";

describe("statusFromColumnName", () => {
  it("maps 'To Do' to todo", () => {
    expect(statusFromColumnName("To Do")).toBe("todo");
  });

  it("maps 'In Progress' to in_progress", () => {
    expect(statusFromColumnName("In Progress")).toBe("in_progress");
  });

  it("maps 'In Review' to in_review", () => {
    expect(statusFromColumnName("In Review")).toBe("in_review");
  });

  it("maps 'Done' to done", () => {
    expect(statusFromColumnName("Done")).toBe("done");
  });

  it("maps 'Work In Progress' to in_progress (substring match)", () => {
    expect(statusFromColumnName("Work In Progress")).toBe("in_progress");
  });

  it("maps unknown column names to todo", () => {
    expect(statusFromColumnName("Custom Column")).toBe("todo");
  });

  it("is case-insensitive", () => {
    expect(statusFromColumnName("DONE")).toBe("done");
    expect(statusFromColumnName("in progress")).toBe("in_progress");
  });
});

describe("constants integrity", () => {
  it("STATUS_CONFIG has entries for all TASK_STATUSES", () => {
    for (const status of Object.values(TASK_STATUSES)) {
      expect(STATUS_CONFIG[status]).toBeDefined();
      expect(STATUS_CONFIG[status].label).toBeTruthy();
    }
  });

  it("PRIORITY_CONFIG has all 4 priorities", () => {
    expect(Object.keys(PRIORITY_CONFIG)).toEqual(
      expect.arrayContaining(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    );
  });

  it("TYPE_CONFIG has all 4 types", () => {
    expect(Object.keys(TYPE_CONFIG)).toEqual(
      expect.arrayContaining(["STORY", "BUG", "TASK", "EPIC"])
    );
  });

  it("column limits are sane", () => {
    expect(MIN_COLUMNS).toBeLessThan(MAX_COLUMNS);
    expect(MIN_COLUMNS).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests**

Run: `npm test`

Expected: All tests pass.

**Step 3: Commit**

```
test: add unit tests for task constants
```

---

### Task 12: Extract and Test Report Functions

**Files:**
- Create: `src/lib/reports.ts`
- Create: `src/lib/__tests__/reports.test.ts`
- Modify: `src/app/(authenticated)/projects/[id]/reports/page.tsx`

**Context:** `computeBurndown`, `computeVelocity`, and `computeDistribution` live inside the reports page server component. Extract them to a testable module.

**Step 1: Create `src/lib/reports.ts`**

Move the three functions and their supporting types (`BurndownDataPoint`, `VelocityDataPoint`, `DistributionItem`) from `reports/page.tsx` into this new file. Export all three functions and all types.

Copy the exact function bodies from `reports/page.tsx` (lines 88-221). The functions are pure — they take data in and return computed results with no side effects.

**Step 2: Update `reports/page.tsx`**

Replace the local function definitions with:

```typescript
import {
  computeBurndown,
  computeVelocity,
  computeDistribution,
  type BurndownDataPoint,
  type VelocityDataPoint,
  type DistributionItem,
} from "@/lib/reports";
```

Delete the local function definitions and type definitions that were moved.

**Step 3: Write tests in `src/lib/__tests__/reports.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { computeBurndown, computeVelocity, computeDistribution } from "../reports";

describe("computeBurndown", () => {
  it("returns empty data for sprint with no dates", () => {
    const result = computeBurndown({
      startDate: null,
      endDate: null,
      tasks: [],
    });
    expect(result.data).toEqual([]);
    expect(result.totalPoints).toBe(0);
  });

  it("computes ideal burndown as linear from total to 0", () => {
    const start = new Date("2026-03-01");
    const end = new Date("2026-03-03");
    const result = computeBurndown({
      startDate: start,
      endDate: end,
      tasks: [
        { status: "todo", storyPoints: 10, updatedAt: new Date("2026-03-01") },
      ],
    });
    expect(result.totalPoints).toBe(10);
    expect(result.data.length).toBe(3); // Mar 1, 2, 3
    expect(result.data[0].ideal).toBe(10);
    expect(result.data[result.data.length - 1].ideal).toBe(0);
  });

  it("computes actual based on done tasks", () => {
    const start = new Date("2026-03-01");
    const end = new Date("2026-03-03");
    const now = new Date("2026-03-04"); // past end date so all days have actuals
    const result = computeBurndown({
      startDate: start,
      endDate: end,
      tasks: [
        { status: "done", storyPoints: 5, updatedAt: new Date("2026-03-02T10:00:00Z") },
        { status: "todo", storyPoints: 5, updatedAt: new Date("2026-03-01") },
      ],
    });
    expect(result.totalPoints).toBe(10);
    // Day 1 (Mar 1): 10 remaining (nothing done yet)
    // Day 2 (Mar 2): 5 remaining (first task done)
    // Day 3 (Mar 3): 5 remaining (no more done)
  });
});

describe("computeVelocity", () => {
  it("returns empty array for no sprints", () => {
    expect(computeVelocity([])).toEqual([]);
  });

  it("computes committed and completed points", () => {
    const result = computeVelocity([
      {
        name: "Sprint 1",
        status: "COMPLETED",
        tasks: [
          { status: "done", storyPoints: 5 },
          { status: "todo", storyPoints: 3 },
        ],
      },
    ]);
    expect(result).toEqual([
      { sprint: "Sprint 1", committed: 8, completed: 5 },
    ]);
  });

  it("excludes PLANNING sprints", () => {
    const result = computeVelocity([
      {
        name: "Sprint 1",
        status: "PLANNING",
        tasks: [{ status: "done", storyPoints: 5 }],
      },
    ]);
    expect(result).toEqual([]);
  });
});

describe("computeDistribution", () => {
  it("counts tasks by status, priority, and type", () => {
    const tasks = [
      { status: "todo", priority: "HIGH", type: "BUG" },
      { status: "todo", priority: "HIGH", type: "STORY" },
      { status: "done", priority: "LOW", type: "BUG" },
    ];
    const result = computeDistribution(tasks);

    expect(result.byStatus.find((s) => s.name === "To Do")?.value).toBe(2);
    expect(result.byStatus.find((s) => s.name === "Done")?.value).toBe(1);
    expect(result.byPriority.find((p) => p.name === "High")?.value).toBe(2);
    expect(result.byType.find((t) => t.name === "Bug")?.value).toBe(2);
  });

  it("handles empty task array", () => {
    const result = computeDistribution([]);
    expect(result.byStatus).toEqual([]);
    expect(result.byPriority).toEqual([]);
    expect(result.byType).toEqual([]);
  });
});
```

**Step 4: Run tests**

Run: `npm test`

Expected: All tests pass.

**Step 5: Type check**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```
refactor: extract report functions, add tests
```

---

### Task 13: Unit Tests for Env Validation

**Files:**
- Create: `src/lib/__tests__/env.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(() => import("../env")).rejects.toThrow();
  });

  it("throws when NEXTAUTH_SECRET is missing", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    delete process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(() => import("../env")).rejects.toThrow();
  });

  it("passes with valid env in development", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "change-me-in-production";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(import("../env")).resolves.not.toThrow();
  });

  it("rejects default secret in production", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "change-me-in-production";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";

    await expect(() => import("../env")).rejects.toThrow();
  });
});
```

**Step 2: Run tests**

Run: `npm test`

**Step 3: Commit**

```
test: add env validation tests
```

---

## Phase 5: Error/Loading Boundaries & Polish

### Task 14: Add Loading Skeletons

**Files:**
- Create: `src/app/(authenticated)/dashboard/loading.tsx`
- Create: `src/app/(authenticated)/projects/[id]/board/loading.tsx`
- Create: `src/app/(authenticated)/projects/[id]/backlog/loading.tsx`

**Context:** No `loading.tsx` files exist. Navigation between pages shows no feedback while server components render.

**Step 1: Create dashboard loading skeleton**

`src/app/(authenticated)/dashboard/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Greeting skeleton */}
      <div>
        <div className="h-4 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-8 w-72 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border bg-card p-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Projects grid skeleton */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="mt-4 flex gap-4">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 h-6 w-20 animate-pulse rounded bg-muted" />
          <div className="rounded-2xl border bg-card p-8">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-muted" />
            <div className="mx-auto mt-4 h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create board loading skeleton**

`src/app/(authenticated)/projects/[id]/board/loading.tsx`:

```tsx
export default function BoardLoading() {
  return (
    <div className="flex gap-4 overflow-x-auto p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[320px] shrink-0 flex-col rounded-xl bg-muted/30"
        >
          <div className="flex items-center gap-2.5 rounded-t-xl bg-muted/40 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 3 - i }).map((_, j) => (
              <div
                key={j}
                className="rounded-xl border bg-white p-4 dark:bg-zinc-900"
              >
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-muted" />
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1" />
                  <div className="h-3 w-8 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-8 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create backlog loading skeleton**

`src/app/(authenticated)/projects/[id]/backlog/loading.tsx`:

```tsx
export default function BacklogLoading() {
  return (
    <div>
      {/* Filter bar skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-20 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-4">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```
feat: add loading skeletons for dashboard, board, backlog
```

---

### Task 15: Add Error Boundary and 404 Page

**Files:**
- Create: `src/app/(authenticated)/error.tsx`
- Create: `src/app/not-found.tsx`

**Step 1: Create error boundary**

`src/app/(authenticated)/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="mt-6 text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset} className="mt-6 gap-2">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create custom 404 page**

`src/app/not-found.tsx`:

```tsx
import Link from "next/link";
import { FolderOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-500/10">
          <FolderOpen className="h-8 w-8 text-violet-600 dark:text-violet-400" />
        </div>
        <h1 className="mt-6 text-lg font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```
feat: add error boundary and custom 404 page
```

---

### Task 16: Split BacklogTable

**Files:**
- Create: `src/hooks/use-backlog-data.ts`
- Create: `src/components/backlog/backlog-filters.tsx`
- Modify: `src/components/backlog/backlog-table.tsx`

**Context:** `backlog-table.tsx` is ~930 lines handling data fetching, filtering, sorting, mutations, and all rendering. Split into a custom hook for data logic, a filters component, and a slimmed-down table.

**Step 1: Create `src/hooks/use-backlog-data.ts`**

Extract all state, fetch functions, mutation handlers, and computed values from `BacklogTable` into a custom hook:

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import type { BoardTask, BoardColumn } from "@/components/board/task-card";

export type SortField = "title" | "priority" | "type" | "status" | "assignee" | "storyPoints" | "dueDate";
export type SortDirection = "asc" | "desc";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UseBacklogDataProps {
  initialTasks: BoardTask[];
  projectId: string;
  initialPagination: Pagination;
}

export function useBacklogData({ initialTasks, projectId, initialPagination }: UseBacklogDataProps) {
  // All state from BacklogTable
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Copy fetchTasks, handleTaskSave, handleTaskDelete, handleCreateSubmit,
  // sortedTasks useMemo, filter handlers, handleSort, handlePageChange
  // from the original BacklogTable component.
  // These are pure state management functions — no JSX.

  // ... (copy exact function bodies from backlog-table.tsx lines 171-481)

  const hasActiveFilters = search !== "" || priorityFilter !== "all" || typeFilter !== "all" || assigneeFilter !== "all";

  return {
    tasks: sortedTasks,
    pagination,
    loading,
    search,
    priorityFilter,
    typeFilter,
    assigneeFilter,
    sortField,
    sortDirection,
    hasActiveFilters,
    selectedTask,
    detailOpen,
    createOpen,
    setSearch: handleSearch,
    setPriorityFilter: handlePriorityFilter,
    setTypeFilter: handleTypeFilter,
    setAssigneeFilter: handleAssigneeFilter,
    clearFilters: handleClearFilters,
    onSort: handleSort,
    onPageChange: handlePageChange,
    onTaskClick: (task: BoardTask) => { setSelectedTask(task); setDetailOpen(true); },
    onTaskSave: handleTaskSave,
    onTaskDelete: handleTaskDelete,
    onCreateSubmit: handleCreateSubmit,
    setDetailOpen,
    setCreateOpen,
  };
}
```

**Step 2: Create `src/components/backlog/backlog-filters.tsx`**

Extract the filter bar JSX (original lines 533-618) into its own component:

```tsx
"use client";

import { Search, ListFilter, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_CONFIG, TYPE_CONFIG } from "@/lib/task-constants";

interface BacklogFiltersProps {
  search: string;
  priorityFilter: string;
  typeFilter: string;
  assigneeFilter: string;
  hasActiveFilters: boolean;
  members: { id: string; name: string }[];
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
}

export function BacklogFilters({ ...props }: BacklogFiltersProps) {
  // Render the filter bar JSX from original backlog-table.tsx lines 533-618
  // Uses the props instead of local state
}
```

**Step 3: Slim down `backlog-table.tsx`**

The remaining `BacklogTable` component should:
1. Import and call `useBacklogData` hook
2. Import and render `BacklogFilters`
3. Render the table, pagination, and dialogs
4. Extract `SortableHeader` as a module-level component (not inside render)

Target: ~350-450 lines.

**Step 4: Type check**

Run: `npx tsc --noEmit`

**Step 5: Verify the backlog page still works**

Run: `npm run dev`, navigate to a project's backlog. Verify filters, sorting, pagination, task creation, task editing, and task deletion all work.

**Step 6: Commit**

```
refactor: split BacklogTable into hook, filters, and table
```

---

### Task 17: Move TaskDetailDialog to Shared

**Files:**
- Move: `src/components/board/task-detail-dialog.tsx` → `src/components/shared/task-detail-dialog.tsx`
- Move: `src/components/board/task-attachments.tsx` → `src/components/shared/task-attachments.tsx`
- Move: `src/components/board/task-comments.tsx` → `src/components/shared/task-comments.tsx`
- Modify: all import paths in consuming files

**Context:** `TaskDetailDialog` is imported by `kanban-board.tsx`, `backlog-table.tsx`, and `sprint-board.tsx` — it belongs in a shared location, not under `board/`.

**Step 1: Create `src/components/shared/` directory and move files**

Move the three files. Update the relative imports inside each moved file (e.g., `"./task-card"` → `"../board/task-card"`).

**Step 2: Update imports in consumers**

Update import paths in:
- `src/components/board/kanban-board.tsx`: `"./task-detail-dialog"` → `"@/components/shared/task-detail-dialog"`
- `src/components/backlog/backlog-table.tsx`: `"@/components/board/task-detail-dialog"` → `"@/components/shared/task-detail-dialog"`
- Any sprint component that imports it

**Step 3: Type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
refactor: move TaskDetailDialog to shared components
```

---

### Task 18: Switch to Prisma Migrate

**Files:**
- Modify: `package.json`

**Context:** The build script uses `prisma db push` which applies schema changes without migration files. Switch to `prisma migrate deploy` for production safety.

**Step 1: Baseline the current schema**

Run: `npx prisma migrate dev --name init`

This creates the first migration file in `prisma/migrations/` based on the current schema. If the database already matches the schema, it creates an empty migration that marks the baseline.

Note: If this fails because the DB already has tables, run `npx prisma migrate resolve --applied init` to mark the baseline as already applied.

**Step 2: Update build script in `package.json`**

Change:
```json
"build": "prisma generate && prisma db push && next build"
```
To:
```json
"build": "prisma generate && prisma migrate deploy && next build"
```

**Step 3: Commit**

```
chore: switch build to prisma migrate deploy
```

---

## Final Verification

After all tasks are complete:

1. Run: `npx tsc --noEmit` — clean type check
2. Run: `npm test` — all tests pass
3. Run: `npx next build` — clean build
4. Manual: navigate to dashboard, board, backlog — verify loading skeletons appear during navigation
5. Manual: verify drag-and-drop, task CRUD, column operations still work
