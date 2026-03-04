# Subtask Checklist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline subtask checklists to task detail dialogs with completion tracking, assignee assignment, drag-reorder, and progress display on Kanban board task cards.

**Architecture:** New `Subtask` Prisma model with dedicated CRUD API endpoints. Subtask checklist UI component embedded in the task detail dialog. Board API updated to calculate progress from new model.

**Tech Stack:** Prisma (data model), Next.js API routes (REST), React + @dnd-kit (drag-reorder), shadcn/ui (UI primitives), Zod (validation)

---

### Task 1: Add Subtask model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the Subtask model and update relations**

In `prisma/schema.prisma`, add the Subtask model after the Attachment model (after line 242), and add relation fields to User and Task models.

Add to the User model (after line 60, `attachments` relation):
```prisma
  assignedSubtasks Subtask[]
```

Add to the Task model (after line 148, `attachments` relation):
```prisma
  checklistItems Subtask[]
```

Add after the Attachment model (after line 242):
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

**Step 2: Generate Prisma client and run migration**

Run:
```bash
npx prisma migrate dev --name add-subtask-model
```
Expected: Migration created and applied successfully. Prisma client regenerated.

**Step 3: Verify migration**

Run:
```bash
npx prisma db push --dry-run
```
Expected: "All data is in sync, nothing to change" or similar confirmation.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Subtask model to schema"
```

---

### Task 2: Create subtask CRUD API routes

**Files:**
- Create: `src/app/api/projects/[id]/tasks/[taskId]/subtasks/route.ts`
- Create: `src/app/api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**Step 1: Create the list + create endpoint**

Create `src/app/api/projects/[id]/tasks/[taskId]/subtasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
  assigneeId: z.string().optional().nullable(),
});

/* GET /api/projects/[id]/tasks/[taskId]/subtasks */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const { session, membership } = await getSessionAndMembership(id);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }
    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "You are not a member of this project." },
        { status: 403 }
      );
    }

    // Verify task belongs to project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId },
      orderBy: { position: "asc" },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ data: subtasks, error: null, message: "OK" });
  } catch (error) {
    console.error("GET subtasks error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch subtasks." },
      { status: 500 }
    );
  }
}

/* POST /api/projects/[id]/tasks/[taskId]/subtasks */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const { session, membership } = await getSessionAndMembership(id);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }
    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "You are not a member of this project." },
        { status: 403 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createSubtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    // Get max position for this task's subtasks
    const maxPos = await prisma.subtask.aggregate({
      where: { taskId },
      _max: { position: true },
    });

    const subtask = await prisma.subtask.create({
      data: {
        title: parsed.data.title,
        assigneeId: parsed.data.assigneeId || null,
        taskId,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json(
      { data: subtask, error: null, message: "Subtask created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create subtask." },
      { status: 500 }
    );
  }
}
```

**Step 2: Create the update + delete endpoint**

Create `src/app/api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

type RouteParams = { params: Promise<{ id: string; taskId: string; subtaskId: string }> };

async function authorize(id: string) {
  const { session, membership } = await getSessionAndMembership(id);
  if (!session?.user) return { ok: false as const, status: 401, message: "You must be signed in." };
  if (!membership) return { ok: false as const, status: 403, message: "You are not a member of this project." };
  return { ok: true as const };
}

/* PATCH /api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId] */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, taskId, subtaskId } = await params;
    const auth = await authorize(id);
    if (!auth.ok) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: auth.message },
        { status: auth.status }
      );
    }

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      select: { id: true, taskId: true, task: { select: { projectId: true } } },
    });
    if (!existing || existing.taskId !== taskId || existing.task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Subtask not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateSubtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.completed !== undefined) updateData.completed = parsed.data.completed;
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;
    if (parsed.data.position !== undefined) updateData.position = parsed.data.position;

    const subtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ data: subtask, error: null, message: "Subtask updated." });
  } catch (error) {
    console.error("PATCH subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update subtask." },
      { status: 500 }
    );
  }
}

/* DELETE /api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId] */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, taskId, subtaskId } = await params;
    const auth = await authorize(id);
    if (!auth.ok) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: auth.message },
        { status: auth.status }
      );
    }

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      select: { id: true, taskId: true, task: { select: { projectId: true } } },
    });
    if (!existing || existing.taskId !== taskId || existing.task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Subtask not found." },
        { status: 404 }
      );
    }

    await prisma.subtask.delete({ where: { id: subtaskId } });

    return NextResponse.json({ data: null, error: null, message: "Subtask deleted." });
  } catch (error) {
    console.error("DELETE subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete subtask." },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify the API routes compile**

Run:
```bash
npx next build 2>&1 | head -30
```
Expected: No TypeScript errors for the new route files.

**Step 4: Commit**

```bash
git add src/app/api/projects/\[id\]/tasks/\[taskId\]/subtasks/
git commit -m "feat: add subtask CRUD API routes"
```

---

### Task 3: Update board API to use Subtask model for progress

**Files:**
- Modify: `src/app/api/projects/[id]/board/route.ts:57-66,92-94`

**Step 1: Update the Prisma query includes**

In `src/app/api/projects/[id]/board/route.ts`, change the `_count` and `subtasks` includes (lines 57-66) from:

```typescript
                _count: {
                  select: {
                    subtasks: true,
                    comments: true,
                    attachments: true,
                  },
                },
                subtasks: {
                  select: { status: true },
                },
```

To:

```typescript
                _count: {
                  select: {
                    comments: true,
                    attachments: true,
                    checklistItems: true,
                  },
                },
                checklistItems: {
                  select: { completed: true },
                },
```

**Step 2: Update the progress calculation**

Change lines 92-94 from:

```typescript
          const completedCount = task.subtasks.filter(
            (s: { status: string }) => s.status === "done"
          ).length;
```

To:

```typescript
          const completedCount = task.checklistItems.filter(
            (s: { completed: boolean }) => s.completed
          ).length;
```

And update the response mapping (lines 111-114) from:

```typescript
            subtaskCount: task._count.subtasks,
            commentCount: task._count.comments,
            attachmentCount: task._count.attachments,
            totalSubtasks: task._count.subtasks,
```

To:

```typescript
            subtaskCount: task._count.checklistItems,
            commentCount: task._count.comments,
            attachmentCount: task._count.attachments,
            totalSubtasks: task._count.checklistItems,
```

And update line 116 from `task._count.subtasks` to `task._count.checklistItems`.

**Step 3: Commit**

```bash
git add src/app/api/projects/\[id\]/board/route.ts
git commit -m "feat: use Subtask model for board progress calculation"
```

---

### Task 4: Update task detail API to return subtasks from new model

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/route.ts:72-84,113-121,229-231,251`

**Step 1: Update GET endpoint query**

In `src/app/api/projects/[id]/tasks/[taskId]/route.ts`, change the subtasks include (lines 72-84) from:

```typescript
        subtasks: {
          orderBy: { createdAt: "asc" },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
```

To:

```typescript
        checklistItems: {
          orderBy: { position: "asc" },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
```

**Step 2: Update GET response mapping**

Change lines 113-121 from:

```typescript
      subtasks: task.subtasks.map((st) => ({
        id: st.id,
        title: st.title,
        status: st.status,
        priority: st.priority,
        type: st.type,
        assignee: st.assignee,
        createdAt: st.createdAt,
      })),
```

To:

```typescript
      subtasks: task.checklistItems.map((st) => ({
        id: st.id,
        title: st.title,
        completed: st.completed,
        position: st.position,
        assignee: st.assignee,
        assigneeId: st.assigneeId,
      })),
```

**Step 3: Update PATCH endpoint _count**

Change line 229-231 from:

```typescript
        _count: {
          select: { subtasks: true },
        },
```

To:

```typescript
        _count: {
          select: { checklistItems: true },
        },
```

And line 251 from:

```typescript
      subtaskCount: task._count.subtasks,
```

To:

```typescript
      subtaskCount: task._count.checklistItems,
```

**Step 4: Commit**

```bash
git add src/app/api/projects/\[id\]/tasks/\[taskId\]/route.ts
git commit -m "feat: return subtasks from Subtask model in task detail API"
```

---

### Task 5: Add shadcn Checkbox component

**Files:**
- Create: `src/components/ui/checkbox.tsx`

**Step 1: Install and add the checkbox component**

Run:
```bash
npx shadcn@latest add checkbox
```
Expected: `src/components/ui/checkbox.tsx` created.

If the CLI prompts, accept defaults. If it fails, create manually.

**Step 2: Commit**

```bash
git add src/components/ui/checkbox.tsx
git commit -m "chore: add shadcn checkbox component"
```

---

### Task 6: Build the SubtaskChecklist component

**Files:**
- Create: `src/components/shared/subtask-checklist.tsx`

**Step 1: Create the subtask checklist component**

Create `src/components/shared/subtask-checklist.tsx`:

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface SubtaskAssignee {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  position: number;
  assignee: SubtaskAssignee | null;
  assigneeId: string | null;
}

interface SubtaskChecklistProps {
  projectId: string;
  taskId: string;
  members: { id: string; name: string; email: string; avatar: string | null }[];
}

/* -------------------------------------------------------------------------- */
/*  Sortable subtask row                                                      */
/* -------------------------------------------------------------------------- */

function SortableSubtaskRow({
  subtask,
  onToggle,
  onUpdateTitle,
  onUpdateAssignee,
  onDelete,
  members,
}: {
  subtask: Subtask;
  onToggle: (id: string, completed: boolean) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onDelete: (id: string) => void;
  members: SubtaskChecklistProps["members"];
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdateTitle(subtask.id, trimmed);
    } else {
      setEditTitle(subtask.title);
    }
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const initials = subtask.assignee
    ? subtask.assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
        "hover:bg-muted/50",
        isDragging && "opacity-50 shadow-lg bg-background ring-1 ring-ring/10"
      )}
    >
      {/* Drag handle */}
      <div
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5 text-muted-foreground" />
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(subtask.id, !subtask.completed)}
        className={cn(
          "size-4 shrink-0 rounded border-2 transition-all duration-200 flex items-center justify-center",
          subtask.completed
            ? "bg-teal-500 border-teal-500 scale-100"
            : "border-muted-foreground/40 hover:border-teal-400"
        )}
      >
        {subtask.completed && <Check className="size-3 text-white" strokeWidth={3} />}
      </button>

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveTitle();
            if (e.key === "Escape") {
              setEditTitle(subtask.title);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 text-sm bg-transparent border-0 outline-none ring-0 px-0 py-0"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 min-w-0 text-sm cursor-text truncate",
            subtask.completed && "line-through text-muted-foreground"
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Assignee */}
      <Select
        value={subtask.assigneeId || "none"}
        onValueChange={(val) => onUpdateAssignee(subtask.id, val === "none" ? null : val)}
      >
        <SelectTrigger className="h-6 w-6 p-0 border-0 shadow-none bg-transparent [&>svg]:hidden shrink-0">
          <SelectValue>
            {subtask.assignee ? (
              <Avatar className="size-5">
                {subtask.assignee.avatar && (
                  <AvatarImage src={subtask.assignee.avatar} alt={subtask.assignee.name} />
                )}
                <AvatarFallback className="text-[9px] bg-gradient-to-br from-brand-600 to-brand-500 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-5 rounded-full border border-dashed border-muted-foreground/30 opacity-0 group-hover:opacity-60" />
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => onDelete(subtask.id)}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0"
      >
        <X className="size-3.5 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main checklist component                                                  */
/* -------------------------------------------------------------------------- */

export function SubtaskChecklist({ projectId, taskId, members }: SubtaskChecklistProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* --- Fetch subtasks --- */
  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`);
      const json = await res.json();
      if (json.data) setSubtasks(json.data);
    } catch {
      console.error("Failed to fetch subtasks");
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  /* --- Create --- */
  const handleAdd = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const json = await res.json();
      if (json.data) {
        setSubtasks((prev) => [...prev, json.data]);
        setNewTitle("");
      }
    } catch {
      toast.error("Failed to add subtask");
    } finally {
      setAdding(false);
    }
  }, [projectId, taskId, newTitle]);

  /* --- Toggle completed --- */
  const handleToggle = useCallback(async (subtaskId: string, completed: boolean) => {
    // Optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, completed } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    } catch {
      // Revert on error
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, completed: !completed } : s))
      );
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId]);

  /* --- Update title --- */
  const handleUpdateTitle = useCallback(async (subtaskId: string, title: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, title } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId]);

  /* --- Update assignee --- */
  const handleUpdateAssignee = useCallback(async (subtaskId: string, assigneeId: string | null) => {
    const assignee = assigneeId ? members.find((m) => m.id === assigneeId) ?? null : null;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, assigneeId, assignee } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
    } catch {
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId, members]);

  /* --- Delete --- */
  const handleDelete = useCallback(async (subtaskId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
    } catch {
      toast.error("Failed to delete subtask");
      fetchSubtasks(); // Refetch on error
    }
  }, [projectId, taskId, fetchSubtasks]);

  /* --- Drag reorder --- */
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(subtasks, oldIndex, newIndex);

    // Optimistic update
    setSubtasks(reordered);

    // Update the moved item's position on server
    try {
      await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/subtasks/${active.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: newIndex }),
        }
      );
    } catch {
      toast.error("Failed to reorder subtasks");
      fetchSubtasks();
    }
  }, [subtasks, projectId, taskId, fetchSubtasks]);

  /* --- Render --- */
  const completedCount = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
        <div className="h-8 w-full bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Subtasks
        </span>
        {total > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{total}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-muted/60 max-w-[120px]">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Subtask list */}
      {total > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {subtasks.map((subtask) => (
                <SortableSubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={handleToggle}
                  onUpdateTitle={handleUpdateTitle}
                  onUpdateAssignee={handleUpdateAssignee}
                  onDelete={handleDelete}
                  members={members}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add subtask input */}
      <div className="flex items-center gap-2">
        <Plus className="size-3.5 text-muted-foreground shrink-0" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !adding) handleAdd();
          }}
          placeholder="Add a subtask..."
          disabled={adding}
          className="flex-1 text-sm bg-transparent border-0 outline-none ring-0 placeholder:text-muted-foreground/60 py-1"
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/shared/subtask-checklist.tsx
git commit -m "feat: add SubtaskChecklist component with drag-reorder"
```

---

### Task 7: Integrate SubtaskChecklist into task detail dialog

**Files:**
- Modify: `src/components/shared/task-detail-dialog.tsx:36-37,168,184-187`

**Step 1: Add the import**

In `src/components/shared/task-detail-dialog.tsx`, add after line 37 (after the TaskComments import):

```typescript
import { SubtaskChecklist } from "./subtask-checklist";
```

**Step 2: Add the subtask checklist section**

Between the description section and the attachments section (between lines 181 and 183), insert the SubtaskChecklist component. Change lines 183-187 from:

```typescript
                {/* Attachments */}
                <TaskAttachments projectId={projectId} taskId={task.id} />

                {/* Comments */}
                <TaskComments projectId={projectId} taskId={task.id} />
```

To:

```typescript
                {/* Subtasks */}
                <SubtaskChecklist
                  projectId={projectId}
                  taskId={task.id}
                  members={members}
                />

                {/* Attachments */}
                <TaskAttachments projectId={projectId} taskId={task.id} />

                {/* Comments */}
                <TaskComments projectId={projectId} taskId={task.id} />
```

**Step 3: Commit**

```bash
git add src/components/shared/task-detail-dialog.tsx
git commit -m "feat: integrate subtask checklist into task detail dialog"
```

---

### Task 8: Manual smoke test and final verification

**Step 1: Start the dev server**

Run:
```bash
npm run dev
```

**Step 2: Verify these flows work**

1. Open a task detail dialog — the "Subtasks" section should appear between description and attachments
2. Type a subtask title and press Enter — subtask should appear in the list
3. Click the checkbox — should toggle with teal fill animation and strikethrough
4. Click the subtask title — should switch to inline edit mode
5. Click the assignee circle — should show member dropdown
6. Drag a subtask by handle — should reorder
7. Hover and click × — should delete
8. Close dialog and check the task card — progress bar should reflect subtask completion
9. Create 3 subtasks, complete 2 — progress should show "67%" on the card

**Step 3: Final commit**

If any fixes were needed, commit them:
```bash
git add -u
git commit -m "fix: subtask checklist polish"
```
