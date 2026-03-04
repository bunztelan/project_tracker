# Task Start Date Feature Design

## Problem

Tasks need a start date to represent when work is planned to begin. Currently tasks only have `dueDate` and `createdAt`. The Gantt chart uses `createdAt` as bar start, which is inaccurate when tasks are planned for later in a sprint or after other work.

## Solution

Add a `startDate` field to tasks. Default to today (task creation day). Users can manually adjust to any date. The Gantt chart uses `startDate` instead of `createdAt` for bar positioning.

## Data Model

Add to `Task` model in Prisma:

```prisma
startDate DateTime? @default(now())
```

## API Changes

**POST `/api/projects/[id]/tasks`**
- Accept optional `startDate` string in Zod schema
- Default to `new Date()` if not provided

**PATCH `/api/projects/[id]/tasks/[taskId]`**
- Accept optional nullable `startDate` in Zod schema
- Allow clearing (falls back to `createdAt` in Gantt)

## UI Changes

**Task detail dialog (`task-detail-dialog.tsx`)**
- Add "Start Date" picker above existing "Due Date" picker in sidebar
- Same Calendar + Popover pattern as due date
- Display: `format(startDate, "MMM d, yyyy")`

**Create task dialog** — no change (auto-defaults to today)

**Task cards** — no change (cards don't show dates)

## Gantt Chart Changes

**`gantt-chart.tsx`**
- Update `TimelineTask` type: add `startDate: string`
- `getBarStyle()`: use `new Date(task.startDate)` instead of `new Date(task.createdAt)` for bar start
- Timeline range calculation: include `startDate` in dates array
- Fallback: if `startDate` is null (legacy tasks), use `createdAt`

**`timeline/page.tsx`**
- Include `startDate` in shaped task data sent to client

## Validation

- Soft validation: warn if `startDate > dueDate` (don't block save)
- No task dependency logic — start dates are purely manual

## No Dependencies

Start dates are manually set. No auto-shifting based on other tasks completing. Dependencies can be added as a future feature.
