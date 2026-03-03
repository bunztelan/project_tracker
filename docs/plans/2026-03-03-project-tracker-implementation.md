# ProjectTracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working Jira-like project management prototype with Excel data visualization for a banking client proposal.

**Architecture:** Next.js 15 full-stack app (App Router + API Routes) with Prisma ORM and PostgreSQL. Single Docker container for self-hosted deployment.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, NextAuth.js, SheetJS, Recharts, @dnd-kit, Zod, Vitest, Playwright

---

## Phase 1: Project Setup & Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `.env.example`

**Step 1: Create Next.js app with TypeScript and Tailwind**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Verify the app runs**

Run: `npm run dev`
Expected: App running on http://localhost:3000

**Step 3: Create .env.example**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_tracker"
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

**Step 4: Create .env with same contents (gitignored)**

Copy `.env.example` to `.env`

**Step 5: Commit**

```bash
git add -A && git commit -m "Initialize Next.js project"
```

---

### Task 2: Install Core Dependencies

**Step 1: Install production dependencies**

Run:
```bash
npm install prisma @prisma/client next-auth @auth/prisma-adapter bcryptjs xlsx recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zod sonner
```

**Step 2: Install dev dependencies**

Run:
```bash
npm install -D @types/bcryptjs vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Install core dependencies"
```

---

### Task 3: Initialize shadcn/ui

**Step 1: Initialize shadcn**

Run:
```bash
npx shadcn@latest init -d
```

Select: New York style, Zinc color, CSS variables enabled.

**Step 2: Add commonly needed components**

Run:
```bash
npx shadcn@latest add button card dialog dropdown-menu input label select separator sheet sidebar table tabs toast badge avatar form popover command calendar
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Initialize shadcn/ui with base components"
```

---

### Task 4: Setup Prisma and Database Schema

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Initialize Prisma**

Run:
```bash
npx prisma init
```

**Step 2: Write the full database schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MANAGER
  MEMBER
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TaskType {
  STORY
  BUG
  TASK
  EPIC
}

enum SprintStatus {
  PLANNING
  ACTIVE
  COMPLETED
}

enum WidgetType {
  BAR
  LINE
  PIE
  TABLE
  KPI
}

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String
  password       String
  role           Role      @default(MEMBER)
  avatar         String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  ownedProjects  Project[]
  assignedTasks  Task[]    @relation("TaskAssignee")
  reportedTasks  Task[]    @relation("TaskReporter")
  excelUploads   ExcelUpload[]
  projectMembers ProjectMember[]
}

model Project {
  id             String          @id @default(cuid())
  name           String
  description    String?
  key            String          @unique
  status         String          @default("active")
  ownerId        String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  owner          User            @relation(fields: [ownerId], references: [id])
  boards         Board[]
  tasks          Task[]
  sprints        Sprint[]
  featureToggles FeatureToggle[]
  excelUploads   ExcelUpload[]
  dashboards     Dashboard[]
  members        ProjectMember[]
}

model ProjectMember {
  id        String   @id @default(cuid())
  userId    String
  projectId String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id])
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
}

model Board {
  id        String   @id @default(cuid())
  name      String
  projectId String
  createdAt DateTime @default(now())

  project Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  columns Column[]
}

model Column {
  id       String @id @default(cuid())
  name     String
  position Int
  boardId  String

  board Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks Task[]
}

model Task {
  id          String       @id @default(cuid())
  title       String
  description String?
  status      String       @default("todo")
  priority    TaskPriority @default(MEDIUM)
  type        TaskType     @default(TASK)
  storyPoints Int?
  position    Int          @default(0)
  dueDate     DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  projectId  String
  columnId   String?
  assigneeId String?
  reporterId String?
  sprintId   String?
  parentId   String?

  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  column   Column?  @relation(fields: [columnId], references: [id])
  assignee User?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  reporter User?    @relation("TaskReporter", fields: [reporterId], references: [id])
  sprint   Sprint?  @relation(fields: [sprintId], references: [id])
  parent   Task?    @relation("TaskSubtasks", fields: [parentId], references: [id])
  subtasks Task[]   @relation("TaskSubtasks")
}

model Sprint {
  id        String       @id @default(cuid())
  name      String
  goal      String?
  startDate DateTime?
  endDate   DateTime?
  status    SprintStatus @default(PLANNING)
  projectId String
  createdAt DateTime     @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks   Task[]
}

model FeatureToggle {
  id          String  @id @default(cuid())
  featureKey  String
  enabled     Boolean @default(false)
  description String?
  projectId   String

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([featureKey, projectId])
}

model ExcelUpload {
  id             String   @id @default(cuid())
  fileName       String
  fileSize       Int
  parsedData     Json
  columnMappings Json?
  uploadedById   String
  projectId      String
  createdAt      DateTime @default(now())

  uploadedBy User    @relation(fields: [uploadedById], references: [id])
  project    Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Dashboard {
  id        String   @id @default(cuid())
  name      String
  projectId String
  createdAt DateTime @default(now())

  project Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  widgets DashboardWidget[]
}

model DashboardWidget {
  id          String     @id @default(cuid())
  type        WidgetType
  config      Json
  position    Int        @default(0)
  size        String     @default("medium")
  dashboardId String

  dashboard Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Generate Prisma client and push schema**

Run:
```bash
npx prisma generate && npx prisma db push
```

**Step 5: Commit**

```bash
git add -A && git commit -m "Add Prisma schema and database models"
```

---

### Task 5: Setup Database Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma seed config)

**Step 1: Write seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@projecttracker.com" },
    update: {},
    create: {
      email: "admin@projecttracker.com",
      name: "Admin User",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  // Create manager user
  const managerPassword = await bcrypt.hash("manager123", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@projecttracker.com" },
    update: {},
    create: {
      email: "manager@projecttracker.com",
      name: "Manager User",
      password: managerPassword,
      role: Role.MANAGER,
    },
  });

  // Create member user
  const memberPassword = await bcrypt.hash("member123", 10);
  const member = await prisma.user.upsert({
    where: { email: "member@projecttracker.com" },
    update: {},
    create: {
      email: "member@projecttracker.com",
      name: "Member User",
      password: memberPassword,
      role: Role.MEMBER,
    },
  });

  // Create a demo project
  const project = await prisma.project.upsert({
    where: { key: "DEMO" },
    update: {},
    create: {
      name: "Demo Project",
      description: "A demo project to showcase features",
      key: "DEMO",
      ownerId: admin.id,
    },
  });

  // Add members
  await prisma.projectMember.createMany({
    data: [
      { userId: admin.id, projectId: project.id, role: Role.ADMIN },
      { userId: manager.id, projectId: project.id, role: Role.MANAGER },
      { userId: member.id, projectId: project.id, role: Role.MEMBER },
    ],
    skipDuplicates: true,
  });

  // Create default feature toggles
  const features = [
    { featureKey: "kanban_board", enabled: true, description: "Kanban board view" },
    { featureKey: "backlog", enabled: true, description: "Backlog management" },
    { featureKey: "sprint_planning", enabled: false, description: "Sprint planning and management" },
    { featureKey: "gantt_timeline", enabled: false, description: "Gantt chart timeline view" },
    { featureKey: "reports", enabled: true, description: "Reporting dashboards" },
    { featureKey: "excel_visualization", enabled: true, description: "Excel data upload and visualization" },
  ];

  for (const feature of features) {
    await prisma.featureToggle.upsert({
      where: { featureKey_projectId: { featureKey: feature.featureKey, projectId: project.id } },
      update: {},
      create: { ...feature, projectId: project.id },
    });
  }

  // Create default board with columns
  const board = await prisma.board.create({
    data: {
      name: "Main Board",
      projectId: project.id,
      columns: {
        create: [
          { name: "To Do", position: 0 },
          { name: "In Progress", position: 1 },
          { name: "In Review", position: 2 },
          { name: "Done", position: 3 },
        ],
      },
    },
    include: { columns: true },
  });

  // Create sample tasks
  const todoCol = board.columns.find((c) => c.name === "To Do")!;
  const inProgressCol = board.columns.find((c) => c.name === "In Progress")!;

  await prisma.task.createMany({
    data: [
      { title: "Setup project infrastructure", status: "done", priority: "HIGH", type: "TASK", projectId: project.id, columnId: board.columns.find((c) => c.name === "Done")!.id, reporterId: admin.id, assigneeId: admin.id, position: 0 },
      { title: "Design database schema", status: "in_review", priority: "HIGH", type: "TASK", projectId: project.id, columnId: board.columns.find((c) => c.name === "In Review")!.id, reporterId: admin.id, assigneeId: manager.id, position: 0 },
      { title: "Implement authentication", status: "in_progress", priority: "CRITICAL", type: "STORY", projectId: project.id, columnId: inProgressCol.id, reporterId: manager.id, assigneeId: admin.id, position: 0, storyPoints: 5 },
      { title: "Build kanban board UI", status: "todo", priority: "HIGH", type: "STORY", projectId: project.id, columnId: todoCol.id, reporterId: manager.id, position: 0, storyPoints: 8 },
      { title: "Add Excel file upload", status: "todo", priority: "MEDIUM", type: "STORY", projectId: project.id, columnId: todoCol.id, reporterId: admin.id, position: 1, storyPoints: 5 },
      { title: "Fix login page styling", status: "todo", priority: "LOW", type: "BUG", projectId: project.id, columnId: todoCol.id, reporterId: member.id, position: 2 },
    ],
  });

  // Create default dashboard
  await prisma.dashboard.create({
    data: {
      name: "Project Dashboard",
      projectId: project.id,
    },
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed config to package.json**

Add to `package.json`:
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Install tsx: `npm install -D tsx`

**Step 3: Run the seed**

Run: `npx prisma db seed`

**Step 4: Commit**

```bash
git add -A && git commit -m "Add database seed script with demo data"
```

---

## Phase 2: Authentication

### Task 6: Setup NextAuth.js

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

**Step 1: Create auth configuration**

Create `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
```

**Step 2: Create auth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 3: Create Next.js auth types**

Create `src/types/next-auth.d.ts`:

```typescript
import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
```

**Step 4: Create middleware for protected routes**

Create `src/middleware.ts`:

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/admin/:path*",
  ],
};
```

**Step 5: Create session provider wrapper**

Create `src/components/providers/session-provider.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 6: Update root layout to include providers**

Modify `src/app/layout.tsx` — wrap `{children}` with `<AuthProvider>` and add `<Toaster />` from sonner.

**Step 7: Commit**

```bash
git add -A && git commit -m "Setup NextAuth.js authentication"
```

---

### Task 7: Build Login Page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Build the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to access ProjectTracker</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Test login manually**

Run: `npm run dev`
Navigate to http://localhost:3000/login
Test with: admin@projecttracker.com / admin123

**Step 3: Commit**

```bash
git add -A && git commit -m "Add login page"
```

---

## Phase 3: Core Layout & Navigation

### Task 8: Create App Shell with Sidebar

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/app-header.tsx`
- Create: `src/app/(authenticated)/layout.tsx`

**Step 1: Create the sidebar component**

Create `src/components/layout/app-sidebar.tsx` — a sidebar using shadcn's sidebar component with:
- App logo/name at top
- Navigation links: Dashboard, Projects
- Project-specific nav (shown when viewing a project): Board, Backlog, Sprints, Timeline, Reports, Data, Settings
- User menu at bottom with sign-out
- Navigation items respect feature toggles (hidden when disabled)

**Step 2: Create the header component**

Create `src/components/layout/app-header.tsx` — a top header with:
- Sidebar toggle button
- Breadcrumbs
- User avatar + dropdown menu (profile, sign out)

**Step 3: Create authenticated layout**

Create `src/app/(authenticated)/layout.tsx` — uses `SidebarProvider` + `AppSidebar` + `AppHeader`:

```tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 4: Move dashboard and projects pages under (authenticated) group**

All authenticated pages go under `src/app/(authenticated)/`.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add app shell with sidebar and header"
```

---

### Task 9: Build Dashboard Page

**Files:**
- Create: `src/app/(authenticated)/dashboard/page.tsx`

**Step 1: Build dashboard page**

Dashboard shows:
- Welcome message with user name
- KPI cards row: Total Projects, Total Tasks, Tasks In Progress, Tasks Completed
- Recent projects list (cards)
- Recent activity feed

Use shadcn `Card` components. Fetch data via server component using Prisma directly.

**Step 2: Commit**

```bash
git add -A && git commit -m "Add dashboard page with KPI cards"
```

---

## Phase 4: Project Management

### Task 10: Build Projects List Page

**Files:**
- Create: `src/app/(authenticated)/projects/page.tsx`
- Create: `src/app/(authenticated)/projects/new/page.tsx`
- Create: `src/app/api/projects/route.ts`

**Step 1: Create projects API route**

`src/app/api/projects/route.ts`:
- GET: List all projects the user is a member of
- POST: Create a new project (Admin/Manager only). Auto-creates default board with 4 columns, default feature toggles, default dashboard, and adds creator as member.

Validate with Zod:
```typescript
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  key: z.string().min(2).max(10).toUpperCase(),
});
```

**Step 2: Build projects list page**

Server component that lists projects as cards. Each card shows: name, key, description, member count, task count. "New Project" button for Admin/Manager.

**Step 3: Build new project form page**

Client component with form: name, key (auto-generated from name), description. Submits to POST /api/projects, redirects to project board on success.

**Step 4: Commit**

```bash
git add -A && git commit -m "Add projects list and create project pages"
```

---

### Task 11: Build Project Layout with Feature-Aware Navigation

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/layout.tsx`
- Create: `src/lib/features.ts`
- Create: `src/app/api/projects/[id]/route.ts`

**Step 1: Create feature toggle helper**

`src/lib/features.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function getProjectFeatures(projectId: string) {
  const toggles = await prisma.featureToggle.findMany({
    where: { projectId },
  });
  return Object.fromEntries(toggles.map((t) => [t.featureKey, t.enabled]));
}

export function isFeatureEnabled(features: Record<string, boolean>, key: string): boolean {
  return features[key] ?? false;
}
```

**Step 2: Create project layout**

`src/app/(authenticated)/projects/[id]/layout.tsx`:
- Fetches project details and feature toggles
- Passes feature flags to sidebar context
- Shows project name in header
- 404 if project not found

**Step 3: Create project detail API**

`src/app/api/projects/[id]/route.ts`:
- GET: Return project with members, feature toggles
- PATCH: Update project details (Admin/Manager)
- DELETE: Delete project (Admin only)

**Step 4: Commit**

```bash
git add -A && git commit -m "Add project layout with feature-aware navigation"
```

---

## Phase 5: Kanban Board

### Task 12: Build Kanban Board API

**Files:**
- Create: `src/app/api/projects/[id]/board/route.ts`
- Create: `src/app/api/projects/[id]/tasks/route.ts`
- Create: `src/app/api/projects/[id]/tasks/[taskId]/route.ts`
- Create: `src/app/api/projects/[id]/tasks/reorder/route.ts`

**Step 1: Board API**

GET `/api/projects/[id]/board` — returns board with columns and tasks (ordered by position).

**Step 2: Tasks CRUD API**

- GET `/api/projects/[id]/tasks` — list tasks with filters (status, assignee, priority, sprint, search)
- POST `/api/projects/[id]/tasks` — create task

Zod validation:
```typescript
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["STORY", "BUG", "TASK", "EPIC"]).optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  storyPoints: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  sprintId: z.string().optional(),
});
```

**Step 3: Single task API**

- GET `/api/projects/[id]/tasks/[taskId]` — task detail with subtasks
- PATCH `/api/projects/[id]/tasks/[taskId]` — update task
- DELETE `/api/projects/[id]/tasks/[taskId]` — delete task

**Step 4: Reorder API**

POST `/api/projects/[id]/tasks/reorder` — accepts `{ taskId, columnId, position }` to handle drag-and-drop reordering.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add kanban board and tasks API routes"
```

---

### Task 13: Build Kanban Board UI

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/board/page.tsx`
- Create: `src/components/board/kanban-board.tsx`
- Create: `src/components/board/kanban-column.tsx`
- Create: `src/components/board/task-card.tsx`
- Create: `src/components/board/task-detail-dialog.tsx`
- Create: `src/components/board/create-task-dialog.tsx`

**Step 1: Create TaskCard component**

Shows: title, priority badge (color-coded), assignee avatar, story points badge, task type icon. Clickable to open detail dialog.

**Step 2: Create KanbanColumn component**

Droppable zone using `@dnd-kit/sortable`. Shows column name, task count, "+" button for quick-add. Renders list of TaskCard components.

**Step 3: Create KanbanBoard component**

Uses `@dnd-kit/core` DndContext. Renders columns horizontally. Handles `onDragEnd` — calls reorder API to persist position changes.

**Step 4: Create TaskDetailDialog**

Modal dialog for editing a task. Fields: title, description (textarea), status, priority, type, assignee (dropdown), story points, due date, parent task. Save and delete buttons.

**Step 5: Create CreateTaskDialog**

Simpler dialog for quick task creation. Fields: title, priority, type, assignee. Creates task in the selected column.

**Step 6: Create board page**

Server component that fetches board data, renders `<KanbanBoard />`.

**Step 7: Test manually**

Run dev server, navigate to `/projects/[id]/board`, verify drag-and-drop works, create/edit/delete tasks.

**Step 8: Commit**

```bash
git add -A && git commit -m "Add kanban board UI with drag-and-drop"
```

---

## Phase 6: Backlog & Sprint Planning

### Task 14: Build Backlog Page

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/backlog/page.tsx`
- Create: `src/components/backlog/backlog-table.tsx`

**Step 1: Build backlog table component**

Table view of all tasks not assigned to a sprint (or all tasks, filterable). Columns: key, title, type, priority, assignee, story points, status. Sortable columns, search filter. Uses shadcn `Table` + `DataTable` pattern. Row click opens TaskDetailDialog.

**Step 2: Build backlog page**

Fetches tasks with `sprintId: null`, renders BacklogTable. Add "Create Task" button.

**Step 3: Commit**

```bash
git add -A && git commit -m "Add backlog page with table view"
```

---

### Task 15: Build Sprint Management

**Files:**
- Create: `src/app/api/projects/[id]/sprints/route.ts`
- Create: `src/app/api/projects/[id]/sprints/[sprintId]/route.ts`
- Create: `src/app/(authenticated)/projects/[id]/sprints/page.tsx`
- Create: `src/components/sprints/sprint-board.tsx`
- Create: `src/components/sprints/create-sprint-dialog.tsx`

**Step 1: Sprint API routes**

- GET/POST `/api/projects/[id]/sprints` — list and create sprints
- GET/PATCH/DELETE `/api/projects/[id]/sprints/[sprintId]` — sprint detail/update/delete
- PATCH supports: start sprint (set ACTIVE), complete sprint (set COMPLETED)

**Step 2: Sprint page UI**

Shows active sprint at top (if any) with progress bar. Below: list of planning/completed sprints. Each sprint shows tasks assigned to it. Drag tasks from backlog into sprint (or use a "Move to Sprint" action).

**Step 3: Create sprint dialog**

Form: name, goal, start date, end date.

**Step 4: Commit**

```bash
git add -A && git commit -m "Add sprint planning page and API"
```

---

## Phase 7: Timeline / Gantt Chart

### Task 16: Build Gantt Chart View

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/timeline/page.tsx`
- Create: `src/components/timeline/gantt-chart.tsx`

**Step 1: Install Gantt dependency or build custom**

Use a lightweight approach: build a custom Gantt chart using HTML/CSS grid + Recharts for the timeline bars. Each task is a row, time is the X-axis. Color by status/priority.

**Step 2: Build GanttChart component**

- Horizontal scrollable timeline
- Rows = tasks (grouped by sprint or epic)
- Bars show start date to due date
- Color-coded by priority
- Click to open task detail
- Today marker line

**Step 3: Build timeline page**

Fetches tasks with dates, renders GanttChart. Filter by sprint, assignee, type.

**Step 4: Commit**

```bash
git add -A && git commit -m "Add Gantt chart timeline view"
```

---

## Phase 8: Reports & Dashboards

### Task 17: Build Reports Page

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/reports/page.tsx`
- Create: `src/components/reports/burndown-chart.tsx`
- Create: `src/components/reports/velocity-chart.tsx`
- Create: `src/components/reports/task-distribution.tsx`

**Step 1: Build chart components using Recharts**

- **BurndownChart**: Line chart showing ideal vs actual remaining work over sprint period
- **VelocityChart**: Bar chart showing story points completed per sprint
- **TaskDistribution**: Pie charts for tasks by status, priority, type, assignee

**Step 2: Build reports page**

Tab layout: Sprint Report | Velocity | Distribution. Each tab shows relevant charts. Sprint selector dropdown for sprint-specific reports.

**Step 3: Commit**

```bash
git add -A && git commit -m "Add reports page with charts"
```

---

## Phase 9: Excel Upload & Visualization

### Task 18: Build Excel Upload API

**Files:**
- Create: `src/app/api/projects/[id]/excel/route.ts`
- Create: `src/app/api/projects/[id]/excel/[uploadId]/route.ts`
- Create: `src/lib/excel.ts`

**Step 1: Create Excel parsing utility**

`src/lib/excel.ts`:

```typescript
import * as XLSX from "xlsx";

export function parseExcelBuffer(buffer: Buffer): {
  sheetNames: string[];
  sheets: Record<string, { headers: string[]; rows: Record<string, unknown>[] }>;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: Record<string, { headers: string[]; rows: Record<string, unknown>[] }> = {};

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    sheets[name] = { headers, rows: json };
  }

  return { sheetNames: workbook.SheetNames, sheets };
}
```

**Step 2: Excel upload API**

- POST `/api/projects/[id]/excel` — accepts multipart form upload (.xlsx/.csv, max 10MB), parses with SheetJS, stores parsed data in ExcelUpload table
- GET `/api/projects/[id]/excel` — list uploads for project
- GET `/api/projects/[id]/excel/[uploadId]` — get parsed data for an upload
- DELETE `/api/projects/[id]/excel/[uploadId]` — delete upload

**Step 3: Commit**

```bash
git add -A && git commit -m "Add Excel upload API with parsing"
```

---

### Task 19: Build Excel Visualization UI

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/data/page.tsx`
- Create: `src/components/data/excel-upload.tsx`
- Create: `src/components/data/data-preview-table.tsx`
- Create: `src/components/data/chart-builder.tsx`
- Create: `src/components/data/chart-renderer.tsx`
- Create: `src/app/api/projects/[id]/dashboards/route.ts`
- Create: `src/app/api/projects/[id]/dashboards/widgets/route.ts`

**Step 1: Build ExcelUpload component**

Drag-and-drop file upload zone. Accepts .xlsx and .csv. Shows upload progress. On success, displays DataPreviewTable.

**Step 2: Build DataPreviewTable component**

Renders parsed Excel data as a paginated shadcn Table. Sheet selector tabs (for multi-sheet files). Shows first 100 rows with column headers.

**Step 3: Build ChartBuilder component**

Configuration panel:
- Select data source (uploaded file + sheet)
- Pick chart type: Bar, Line, Pie, Table, KPI
- Map columns: X-axis, Y-axis (supports multiple), Group By
- Preview chart live as user configures
- "Save to Dashboard" button

**Step 4: Build ChartRenderer component**

Renders a chart based on widget config using Recharts:
- Bar → `<BarChart>`
- Line → `<LineChart>`
- Pie → `<PieChart>`
- Table → shadcn `<Table>`
- KPI → Large number card with label

**Step 5: Dashboard widgets API**

- POST `/api/projects/[id]/dashboards/widgets` — save widget config
- PATCH/DELETE for widget management

**Step 6: Build data page**

Two sections:
1. Upload & Preview (top) — file upload + data table
2. Visualization (bottom) — chart builder + saved charts grid

**Step 7: Commit**

```bash
git add -A && git commit -m "Add Excel visualization with chart builder"
```

---

## Phase 10: Settings & Admin

### Task 20: Build Project Settings Page

**Files:**
- Create: `src/app/(authenticated)/projects/[id]/settings/page.tsx`
- Create: `src/components/settings/feature-toggles.tsx`
- Create: `src/components/settings/member-management.tsx`
- Create: `src/app/api/projects/[id]/features/route.ts`
- Create: `src/app/api/projects/[id]/members/route.ts`

**Step 1: Feature toggle API**

- GET `/api/projects/[id]/features` — list toggles
- PATCH `/api/projects/[id]/features` — update toggles (Admin/Manager)

**Step 2: Members API**

- GET `/api/projects/[id]/members` — list members
- POST `/api/projects/[id]/members` — add member
- DELETE `/api/projects/[id]/members/[memberId]` — remove member

**Step 3: Build settings page**

Tabs: General | Features | Members

- General: edit project name, description, key
- Features: toggle switches for each feature with descriptions
- Members: table of members with role badges, add/remove buttons

**Step 4: Commit**

```bash
git add -A && git commit -m "Add project settings with feature toggles and member management"
```

---

### Task 21: Build Admin Page

**Files:**
- Create: `src/app/(authenticated)/admin/page.tsx`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[userId]/route.ts`

**Step 1: Admin users API**

- GET `/api/admin/users` — list all users (Admin only)
- POST `/api/admin/users` — create user (Admin only)
- PATCH `/api/admin/users/[userId]` — update user role (Admin only)
- DELETE `/api/admin/users/[userId]` — delete user (Admin only)

All routes check session role === ADMIN.

**Step 2: Build admin page**

Users table: name, email, role, created date. Actions: edit role (dropdown), delete. "Create User" button with dialog form.

**Step 3: Commit**

```bash
git add -A && git commit -m "Add admin page with user management"
```

---

## Phase 11: Docker & Deployment

### Task 22: Add Docker Configuration

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Step 2: Create docker-compose.yml**

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: project_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/project_tracker
      NEXTAUTH_SECRET: change-me-in-production
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - db

volumes:
  pgdata:
```

**Step 3: Create .dockerignore**

```
node_modules
.next
.git
```

**Step 4: Update next.config.ts for standalone output**

Add `output: "standalone"` to next.config.ts.

**Step 5: Test Docker build**

Run: `docker compose up --build`
Verify app is accessible at http://localhost:3000

**Step 6: Commit**

```bash
git add -A && git commit -m "Add Docker configuration"
```

---

## Phase 12: Polish & Testing

### Task 23: Add Loading States and Error Boundaries

**Files:**
- Create: `src/app/(authenticated)/loading.tsx`
- Create: `src/app/(authenticated)/error.tsx`
- Create: `src/app/(authenticated)/projects/[id]/board/loading.tsx`

**Step 1: Add skeleton loading states**

Use shadcn `Skeleton` component for loading states on key pages: dashboard, board, projects list.

**Step 2: Add error boundary**

Generic error boundary component that shows a friendly error message with retry button.

**Step 3: Commit**

```bash
git add -A && git commit -m "Add loading states and error boundaries"
```

---

### Task 24: Write Key Tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/lib/excel.test.ts`
- Create: `src/__tests__/lib/features.test.ts`

**Step 1: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `src/__tests__/setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

**Step 2: Write Excel parsing tests**

Test `parseExcelBuffer` with sample data — verify headers extracted, rows parsed, multi-sheet support.

**Step 3: Write feature toggle tests**

Test `isFeatureEnabled` helper — verify returns correct boolean for enabled/disabled/missing features.

**Step 4: Add test script to package.json**

```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Run tests**

Run: `npm run test:run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add -A && git commit -m "Add Vitest config and unit tests"
```

---

### Task 25: Final Cleanup and README

**Files:**
- Modify: `src/app/page.tsx` — redirect to `/dashboard` or show landing
- Modify: `CLAUDE.md` — update with final project structure

**Step 1: Update root page**

Redirect unauthenticated users to `/login`, authenticated users to `/dashboard`.

**Step 2: Update CLAUDE.md with final project structure**

Add file tree and development commands.

**Step 3: Final commit**

```bash
git add -A && git commit -m "Final cleanup and documentation"
```
