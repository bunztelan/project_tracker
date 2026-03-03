# ProjectTracker Design Document

**Date:** 2026-03-03
**Status:** Approved
**Purpose:** Working prototype of a Jira-like project management app for a banking client proposal

## Context

- **Client:** Prospective banking client (large bank)
- **Users:** 5-15 people
- **Deliverable:** Working prototype for demo
- **Deployment:** Cloud-first, but Docker-containerized for self-hosted/on-premise (likely for a bank)

## Architecture

**Approach:** Next.js Full-Stack (single codebase)

```
Docker Container
├── Next.js 15 (App Router)
│   ├── Frontend (React 19, Server Components)
│   └── API Routes (REST endpoints)
├── Prisma ORM
└── PostgreSQL
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (credentials provider, JWT) |
| Excel parsing | SheetJS (xlsx) |
| Charts | Recharts |
| Drag & drop | @dnd-kit |
| Validation | Zod |
| Notifications | Sonner (toast) |
| Testing | Vitest, React Testing Library, Playwright |
| Deployment | Docker + Docker Compose |

## Data Model

### User
- id, email, name, password (hashed), role (ADMIN | MANAGER | MEMBER)
- avatar, createdAt, updatedAt

### Project
- id, name, description, key (e.g. "PROJ"), status
- ownerId -> User
- createdAt, updatedAt

### Board
- id, name, projectId -> Project
- columns: Column[]

### Column
- id, name, position, boardId -> Board

### Task
- id, title, description, status, priority (LOW | MEDIUM | HIGH | CRITICAL)
- type (STORY | BUG | TASK | EPIC), storyPoints
- assigneeId -> User, reporterId -> User
- projectId -> Project, columnId -> Column
- sprintId -> Sprint (nullable)
- parentId -> Task (subtasks)
- dueDate, position
- createdAt, updatedAt

### Sprint
- id, name, goal, projectId -> Project
- startDate, endDate, status (PLANNING | ACTIVE | COMPLETED)

### FeatureToggle
- id, featureKey, enabled (boolean), projectId -> Project
- description

### ExcelUpload
- id, fileName, fileSize, uploadedById -> User
- projectId -> Project
- parsedData (JSON), columnMappings (JSON)
- createdAt

### Dashboard
- id, name, projectId -> Project

### DashboardWidget
- id, dashboardId -> Dashboard
- type (BAR | LINE | PIE | TABLE | KPI)
- config (JSON), position, size

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Email/password login |
| `/dashboard` | Overview: all projects, recent activity, KPI cards |
| `/projects` | Project list with create/edit |
| `/projects/[id]/board` | Kanban board with drag-and-drop |
| `/projects/[id]/backlog` | Backlog: tasks not in a sprint |
| `/projects/[id]/sprints` | Sprint planning |
| `/projects/[id]/timeline` | Gantt chart with dependencies |
| `/projects/[id]/reports` | Burndown, velocity, sprint reports |
| `/projects/[id]/data` | Excel upload and visualization |
| `/projects/[id]/settings` | Feature toggles, members, config |
| `/admin` | User management (admin only) |

## Feature Toggle System

Toggleable features (per project):

| Feature Key | Default |
|-------------|---------|
| `kanban_board` | ON |
| `backlog` | ON |
| `sprint_planning` | OFF |
| `gantt_timeline` | OFF |
| `reports` | ON |
| `excel_visualization` | ON |

When OFF: nav item hidden, page returns 403.

## Excel Visualization Flow

1. Upload .xlsx / .csv file
2. SheetJS parses the file, preview as table
3. User maps columns to X-axis, Y-axis, grouping
4. User picks chart type (bar, line, pie, table, KPI)
5. Widget saved to project dashboard
6. Re-upload updates data, preserving chart config

## UI Design Direction

**Inspiration:** Monday.com — NOT Jira. The client explicitly dislikes Jira's UI (cluttered, outdated, hard to navigate).

### Design Principles

- **Colorful & visual** — vibrant status colors, colored priority indicators, progress bars with color
- **Spacious & clean** — generous whitespace, no dense tables, breathing room between elements
- **Friendly & approachable** — rounded corners, soft shadows, warm color palette, smooth transitions
- **Minimal clicks** — inline editing where possible, hover-to-reveal actions, keyboard shortcuts
- **Visual status indicators** — colored dots/pills for status, progress rings, color-coded columns

### What to Avoid (Jira Anti-Patterns)

- No dense enterprise-style tables with tiny text
- No deep nested menus or settings panels
- No overwhelming number of visible fields on task cards
- No gray/corporate color scheme
- No cluttered toolbars with dozens of icons

### Color System

- Status columns: each gets a distinct vibrant color (blue, amber, purple, green)
- Priority: color-coded badges (gray=Low, blue=Medium, orange=High, red=Critical)
- Task types: colored icons (green=Story, red=Bug, blue=Task, purple=Epic)
- Progress: gradient progress bars
- Generous use of accent colors throughout, not just gray-on-white

### Component Style

- Cards with rounded-xl corners and subtle shadows
- Hover effects with smooth transitions (150-200ms)
- Avatar groups for team members
- Pill-shaped badges and tags
- Colorful sidebar with active state highlighting
- Empty states with illustrations or friendly messages

## Kanban Board

- Customizable columns (default: To Do, In Progress, In Review, Done)
- Each column has a distinct header color
- Drag-and-drop via @dnd-kit with smooth animation
- Task cards: title, colored priority pill, assignee avatar, story points — clean and minimal
- Click-to-open task detail panel (slide-in, not a dense modal)
- Quick-add task from any column with inline input
- Column task count with colored badge

## Auth & Roles

- NextAuth.js credentials provider, bcrypt password hashing, JWT sessions
- Protected routes via Next.js middleware

| Action | Admin | Manager | Member |
|--------|-------|---------|--------|
| Create/delete projects | Yes | Yes | No |
| Manage project members | Yes | Yes | No |
| Manage feature toggles | Yes | Yes | No |
| Create/edit/delete tasks | Yes | Yes | Yes |
| Upload Excel files | Yes | Yes | Yes |
| Manage sprints | Yes | Yes | No |
| User administration | Yes | No | No |

## Error Handling

- API: consistent `{ data, error, message }` JSON responses
- Client: toast notifications via Sonner
- Validation: Zod schemas shared client/server
- File upload: xlsx/csv only, 10MB max

## Testing

- Unit: Vitest for utilities and data transformations
- Components: React Testing Library
- API: Vitest for route handlers
- E2E: Playwright for critical flows (login, kanban, file upload)
