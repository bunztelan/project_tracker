# Subtask Checklist Design

**Date:** 2026-03-04
**Status:** Approved

## Summary

Add inline subtask checklists to task detail dialogs, enabling users to break tasks into smaller items with completion tracking, assignee assignment, and drag-reorder. Progress is displayed on Kanban board task cards.

## Decisions

- **UX:** Inline checklist in task detail dialog (not a separate panel or board cards)
- **Fields per subtask:** Title, completed (checkbox), assignee, position (for ordering)
- **Data model:** New dedicated `Subtask` model (not reusing Task with parentId)
- **Reordering:** Drag-to-reorder with @dnd-kit

## Data Model

New `Subtask` Prisma model:

```prisma
model Subtask {
  id         String   @id @default(cuid())
  title      String
  completed  Boolean  @default(false)
  position   Int      @default(0)
  taskId     String
  task       Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  assigneeId String?
  assignee   User?    @relation(fields: [assigneeId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([taskId])
}
```

- Cascade delete: removing a parent task deletes all subtasks
- Position field for drag-reorder ordering
- Optional assignee via foreign key to User

## API

### New endpoints

**`/api/projects/[id]/tasks/[taskId]/subtasks`**
- `GET` — all subtasks for a task, ordered by position, includes assignee
- `POST` — create subtask. Body: `{ title, assigneeId? }`. Auto-sets position to max+1

**`/api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId]`**
- `PATCH` — update title, completed, assigneeId, or position
- `DELETE` — delete a subtask

### Modified endpoints

- **Board API** (`/api/projects/[id]/board`) — switch progress calculation from Task self-relation to Subtask model
- **Task detail API** (`/api/projects/[id]/tasks/[taskId]` GET) — include subtasks in response

## UI

### Subtask checklist (task detail dialog)

Location: left column, between description and comments sections.

**Section header:** "Subtasks" with count badge (e.g., "3/5") and small progress bar.

**Each subtask row:** `[drag handle] [checkbox] [title] [assignee avatar] [delete icon on hover]`

**Add subtask:** Inline text input at bottom with placeholder "Add a subtask..." — Enter to add.

**Interactions:**
- Click checkbox → toggle completed (PATCH, optimistic update)
- Click title → inline edit mode (click away or Enter to save)
- Click assignee avatar → dropdown to pick team member
- Drag handle → reorder via @dnd-kit (vertical list)
- Hover row → reveal delete (×) icon
- Completed subtasks: strikethrough title, muted colors

**Styling (Monday.com-inspired):**
- Rounded-lg rows with subtle hover background
- Teal progress bar (matches task card progress bar)
- Smooth checkbox animation (scale + color transition)
- Soft shadows on drag

### Task card (Kanban board)

No visual changes — keep existing teal progress bar with percentage. Switch data source from Task self-relation to new Subtask model.

### Progress refresh flow

1. User toggles subtask checkbox in detail dialog
2. Optimistic update in the dialog
3. API PATCH to update subtask
4. On dialog close or after save, `refreshBoard()` recalculates progress server-side
