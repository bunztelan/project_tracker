# Task Start Date — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `startDate` field to tasks so the Gantt chart shows bars from planned start to due date, instead of from creation date.

**Architecture:** Add `startDate DateTime? @default(now())` to Prisma Task model. Thread it through the API create/update endpoints, the board API response, the task detail dialog UI, and the Gantt chart bar calculation. Default to today on creation; fall back to `createdAt` for legacy tasks without a start date.

**Tech Stack:** Prisma (migration), Zod (validation), Next.js API routes, React (shadcn Calendar + Popover), date-fns

---

### Task 1: Add startDate to Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma:128` (add field after `dueDate`)

**Step 1: Add the field to the schema**

In `prisma/schema.prisma`, add `startDate` on the line after `dueDate` (line 128):

```prisma
  dueDate     DateTime?
  startDate   DateTime?  @default(now())
  createdAt   DateTime   @default(now())
```

**Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name add-task-start-date`
Expected: Migration created and applied, `startDate` column added to `Task` table.

**Step 3: Verify Prisma client regenerated**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add startDate field to Task model"
```

---

### Task 2: Update task create API to accept startDate

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/route.ts:11-22` (Zod schema)
- Modify: `src/app/api/projects/[id]/tasks/route.ts:196-266` (POST handler)

**Step 1: Add startDate to the Zod create schema**

In the `createTaskSchema` (line 11-22), add after the `dueDate` line:

```typescript
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["STORY", "BUG", "TASK", "EPIC"]).optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  storyPoints: z.number().int().min(0).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  parentId: z.string().optional(),
  sprintId: z.string().optional(),
});
```

**Step 2: Destructure startDate and pass to Prisma create**

In the POST handler, add `startDate` to the destructure (around line 196-207):

```typescript
const {
  title, description, priority, type, columnId,
  assigneeId, storyPoints, dueDate, startDate, parentId, sprintId,
} = parsed.data;
```

In the `prisma.task.create` data (around line 250-266), add after `dueDate`:

```typescript
dueDate: dueDate ? new Date(dueDate) : undefined,
startDate: startDate ? new Date(startDate) : new Date(),
```

**Step 3: Add startDate to the response shaping**

In the response data object (around line 290-308), add `startDate`:

```typescript
const data = {
  id: task.id,
  // ... existing fields ...
  startDate: task.startDate,
  dueDate: task.dueDate,
  // ... rest ...
};
```

Also add `startDate` to the GET response shaping (around line 118-137).

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/route.ts
git commit -m "feat: accept startDate in task create API"
```

---

### Task 3: Update task update API to accept startDate

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/route.ts:11-24` (Zod schema)
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/route.ts:186-202` (PATCH handler)

**Step 1: Add startDate to the update Zod schema**

In `updateTaskSchema` (line 11-24), add after `dueDate`:

```typescript
startDate: z.string().optional().nullable(),
```

**Step 2: Handle startDate in the PATCH update logic**

After the `dueDate` handling block (around line 200-202), add:

```typescript
if (fields.startDate !== undefined) {
  updateData.startDate = fields.startDate ? new Date(fields.startDate) : null;
}
```

**Step 3: Add startDate to GET and PATCH response shaping**

In the GET response (around line 94-120) add `startDate: task.startDate` after `dueDate`.

In the PATCH response (around line 230-248) add `startDate: task.startDate` after `dueDate`.

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/route.ts
git commit -m "feat: accept startDate in task update API"
```

---

### Task 4: Add startDate to BoardTask type and board API response

**Files:**
- Modify: `src/components/board/task-card.tsx:25-47` (BoardTask type)
- Modify: `src/app/api/projects/[id]/board/route.ts:96-114` (board response shaping)

**Step 1: Add startDate to BoardTask type**

In the `BoardTask` type (line 25-47 of `task-card.tsx`), add after `dueDate`:

```typescript
startDate: string | null;
```

**Step 2: Add startDate to board API response**

In the board route response shaping (around line 96-114), add after `dueDate`:

```typescript
startDate: task.startDate,
```

**Step 3: Commit**

```bash
git add src/components/board/task-card.tsx src/app/api/projects/[id]/board/route.ts
git commit -m "feat: include startDate in board API and BoardTask type"
```

---

### Task 5: Add Start Date picker to task detail dialog

**Files:**
- Modify: `src/components/shared/task-detail-dialog.tsx`

**Step 1: Add startDate state**

After the `dueDate` state (line 75), add:

```typescript
const [startDate, setStartDate] = useState<Date | undefined>(undefined);
```

**Step 2: Sync startDate from task data**

In the `useEffect` that syncs form state (around line 80-93), add after the `setDueDate` line:

```typescript
setStartDate(task.startDate ? new Date(task.startDate) : undefined);
```

**Step 3: Include startDate in save payload**

In `handleSave` (around line 99-108), add to the data object:

```typescript
startDate: startDate ? startDate.toISOString() : null,
```

Add `startDate` to the `useCallback` dependency array.

**Step 4: Add Start Date picker UI — above the existing Due Date section**

Insert this block before the `{/* Due Date */}` section (before line 294):

```tsx
{/* Start Date */}
<div className="space-y-1.5">
  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
    Start Date
  </Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "w-full justify-start text-left text-xs font-normal h-8",
          !startDate && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-1.5 size-3" />
        {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={startDate}
        onSelect={setStartDate}
        initialFocus
      />
    </PopoverContent>
  </Popover>
  {startDate && (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => setStartDate(undefined)}
      className="text-[10px] text-muted-foreground h-5 px-1"
    >
      Clear date
    </Button>
  )}
</div>
```

**Step 5: Add soft validation warning for startDate > dueDate**

After the Start Date section, add a warning that shows when both dates are set and start is after due:

```tsx
{startDate && dueDate && startDate > dueDate && (
  <p className="text-[10px] text-amber-600 dark:text-amber-400">
    Start date is after due date
  </p>
)}
```

**Step 6: Commit**

```bash
git add src/components/shared/task-detail-dialog.tsx
git commit -m "feat: add start date picker to task detail dialog"
```

---

### Task 6: Update Gantt chart to use startDate for bar positioning

**Files:**
- Modify: `src/components/timeline/gantt-chart.tsx:29-46` (TimelineTask type)
- Modify: `src/components/timeline/gantt-chart.tsx:134-170` (timeline range)
- Modify: `src/components/timeline/gantt-chart.tsx:287-300` (getBarStyle)
- Modify: `src/components/timeline/gantt-chart.tsx:567-577` (tooltip)
- Modify: `src/app/(authenticated)/projects/[id]/timeline/page.tsx:86-98` (data shaping)

**Step 1: Add startDate to TimelineTask type**

In the `TimelineTask` type (line 29-46 of `gantt-chart.tsx`), add after `dueDate`:

```typescript
startDate: string | null;
```

**Step 2: Update timeline range calculation to include startDate**

In the timeline range `useMemo` (around line 148-152), replace:

```typescript
const dates: Date[] = [];
for (const task of tasks) {
  dates.push(new Date(task.createdAt));
  if (task.dueDate) dates.push(new Date(task.dueDate));
}
```

With:

```typescript
const dates: Date[] = [];
for (const task of tasks) {
  dates.push(new Date(task.startDate || task.createdAt));
  if (task.dueDate) dates.push(new Date(task.dueDate));
}
```

**Step 3: Update getBarStyle to use startDate**

In `getBarStyle` (around line 287-300), replace:

```typescript
const startDate = startOfDay(new Date(task.createdAt));
```

With:

```typescript
const startDate = startOfDay(new Date(task.startDate || task.createdAt));
```

**Step 4: Update tooltip to show startDate instead of createdAt**

In the tooltip content (around line 567-577), replace:

```typescript
{format(new Date(task.createdAt), "MMM d")}
```

With:

```typescript
{format(new Date(task.startDate || task.createdAt), "MMM d")}
```

**Step 5: Include startDate in timeline page data shaping**

In `timeline/page.tsx` (around line 86-98), add `startDate` to the shaped tasks:

```typescript
const shapedTasks = tasks.map((task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  type: task.type,
  storyPoints: task.storyPoints,
  startDate: task.startDate ? task.startDate.toISOString() : null,
  dueDate: task.dueDate ? task.dueDate.toISOString() : null,
  createdAt: task.createdAt.toISOString(),
  assignee: task.assignee,
  sprintId: task.sprintId,
}));
```

**Step 6: Update empty state text**

In `timeline/page.tsx` (around line 134), update the description text:

```tsx
<p className="mt-1 max-w-sm text-sm text-muted-foreground">
  Create tasks on the Board or Backlog to see them plotted on the
  timeline. Tasks use their start date and due date to form bars.
</p>
```

**Step 7: Commit**

```bash
git add src/components/timeline/gantt-chart.tsx src/app/(authenticated)/projects/[id]/timeline/page.tsx
git commit -m "feat: use startDate for Gantt chart bar positioning"
```

---

### Task 7: Manual verification

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Verify task creation**

- Create a new task on the Kanban board
- Open the task detail dialog
- Verify `startDate` field appears with today's date pre-filled
- Verify `dueDate` field still works

**Step 3: Verify task editing**

- Change the start date to a future date
- Save and reopen — verify it persisted
- Clear the start date — verify it clears
- Set start date after due date — verify amber warning appears

**Step 4: Verify Gantt chart**

- Navigate to Timeline view
- Verify task bars start from `startDate` (not `createdAt`)
- Verify tasks without `startDate` fall back to `createdAt`
- Verify tooltip shows correct start date

**Step 5: Commit any fixes if needed**
