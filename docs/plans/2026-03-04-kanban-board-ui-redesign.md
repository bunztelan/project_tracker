# Kanban Board UI Redesign

**Date:** 2026-03-04
**Status:** Approved

## Goal

Redesign the Kanban board to match the Monday.com-inspired mockup: pastel-colored columns, richer task cards with progress bars, description previews, and comment/attachment counts.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Progress tracking | Derived from subtasks | completedSubtasks / totalSubtasks × 100 |
| Assignees | Keep single assignee | Sufficient for 5-15 user prototype |
| Card metadata | Comment + attachment counts | Extend board API with Prisma _count |
| Column menu | "..." dropdown (rename, add task, delete) | Matches screenshot, same features |
| Priority colors | Traffic-light (green/amber/rose/red) | More intuitive than current gray/blue/orange/red |
| Approach | Full overhaul (A) | Ship all changes together for consistency |

## Task Card Layout

```
┌─────────────────────────────────┐
│  [Priority Badge]               │  ← Top-left colored pill
│                                 │
│  Task Title                     │  ← Bold, line-clamp-2
│                                 │
│  Note: Description preview...   │  ← Muted text, line-clamp-2, optional
│                                 │
│  Progress              60%      │  ← Label + percentage
│  ████████████░░░░░░░░░░░░░░░░  │  ← Teal/emerald progress bar
│                                 │
│  👤                    📎 3  💬 5 │  ← Avatar left, counts right
└─────────────────────────────────┘
```

**Priority colors:**
- Low → bg-emerald-100 text-emerald-700
- Medium → bg-amber-100 text-amber-700
- High → bg-rose-100 text-rose-700
- Critical → bg-red-100 text-red-700

**Removed from card face:** Type icon, story points (still in task detail dialog).

**Kept:** Drag handle on hover, click-to-open detail, drag overlay effects.

## Column Styling

Columns switch from neutral gray backgrounds to pastel-colored:

| Column | Dot Color | Background | Header BG |
|--------|-----------|-----------|-----------|
| 0: To Do | amber | amber-50 | amber-100/60 |
| 1: In Progress | orange | orange-50 | orange-100/60 |
| 2: In Review | emerald | emerald-50 | emerald-100/60 |
| 3: Completed | green | green-50 | green-100/60 |
| 4: Extra | rose | rose-50 | rose-100/60 |
| 5: Extra | cyan | cyan-50 | cyan-100/60 |

**Header:** Colored dot (8px) + column name + "..." dropdown menu.

**Task count badge:** Removed from header (not in screenshot).

**"..." Dropdown:** Rename column, Add task, Delete column (same functionality as current buttons).

## API Changes

**Board endpoint** (`GET /api/projects/[id]/board`):

Extend Prisma include:
```prisma
tasks: {
  include: {
    assignee: true,
    _count: { select: { comments: true, attachments: true } },
    children: { select: { status: true } }
  }
}
```

**BoardTask type additions:**
```ts
commentCount: number;
attachmentCount: number;
subtaskProgress: number;      // 0-100
completedSubtasks: number;
totalSubtasks: number;
```

Progress calculated server-side: `completedSubtasks / totalSubtasks * 100`.
A task with no subtasks shows 0%.

**No Prisma schema changes required** — Task already has parentId, Comment, and Attachment relations.

## Files to Modify

1. `src/components/board/task-card.tsx` — New card layout, priority colors, progress bar
2. `src/components/board/kanban-column.tsx` — Pastel backgrounds, dot header, dropdown menu
3. `src/components/board/kanban-board.tsx` — Pass new data fields through
4. `app/(authenticated)/projects/[id]/board/page.tsx` — Shape new API data
5. `app/api/projects/[id]/board/route.ts` — Extend Prisma query for counts + subtasks
6. `app/api/projects/[id]/tasks/reorder/route.ts` — No changes needed (drag-drop untouched)

## Out of Scope

- Multi-assignee support
- Manual progress field
- Column sorting
- Column collapse
- Dark mode adjustments (existing dark mode tokens will carry over)
