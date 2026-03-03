# Task Attachments & Comments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add file attachments and a comment system to tasks, served through a new modal task detail view.

**Architecture:** Two new Prisma models (Attachment, Comment). Files stored on local filesystem at `uploads/attachments/<projectId>/<taskId>/`. Served via an auth-gated API route. Task detail view converts from a side Sheet to a centered Dialog with two-column layout (content left, metadata right).

**Tech Stack:** Next.js 15 API routes (FormData), Prisma ORM, shadcn Dialog, Lucide icons, Sonner toasts.

**Design doc:** `docs/plans/2026-03-03-task-attachments-comments-design.md`

---

### Task 1: Prisma Schema — Attachment & Comment Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Comment and Attachment models to schema**

Add to `prisma/schema.prisma` after the `Task` model:

```prisma
model Comment {
  id        String   @id @default(cuid())
  body      String
  taskId    String
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task        Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author      User         @relation(fields: [authorId], references: [id])
  attachments Attachment[]
}

model Attachment {
  id           String   @id @default(cuid())
  fileName     String
  filePath     String
  fileSize     Int
  mimeType     String
  taskId       String?
  commentId    String?
  uploadedById String
  createdAt    DateTime @default(now())

  task       Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  comment    Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  uploadedBy User     @relation(fields: [uploadedById], references: [id])
}
```

Add reverse relations to **Task** model:
```prisma
  comments    Comment[]
  attachments Attachment[]
```

Add reverse relations to **User** model:
```prisma
  comments    Comment[]
  attachments Attachment[]
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add-comments-and-attachments
```

**Step 3: Verify**

```bash
npx prisma generate
npm run build
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Comment and Attachment models"
```

---

### Task 2: File Serving API Route

**Files:**
- Create: `src/app/api/files/[...path]/route.ts`

**Step 1: Create the file serving route**

This route serves files from `uploads/` with auth checking. It reads the projectId from the path (`uploads/attachments/<projectId>/...`) and verifies the user is a member.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const segments = (await params).path;
    // Expected: ["attachments", projectId, taskId, filename]
    if (segments.length < 4 || segments[0] !== "attachments") {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const projectId = segments[1];

    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve and validate file path
    const filePath = path.join(process.cwd(), "uploads", ...segments);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.join(process.cwd(), "uploads"))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!existsSync(resolved)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${segments[segments.length - 1]}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Add `uploads/` to `.gitignore`**

Append to `.gitignore`:
```
uploads/
```

**Step 3: Configure Next.js for larger API body size**

In `next.config.ts`, add the experimental config to allow 10MB uploads:
```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/api/files/ .gitignore next.config.ts
git commit -m "feat: add file serving API with auth check"
```

---

### Task 3: Attachments API Route

**Files:**
- Create: `src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts`
- Create: `src/app/api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]/route.ts`

**Step 1: Create the attachments list + upload route**

`src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts`

Handles:
- `GET` — list standalone task attachments (where `taskId` is set and `commentId` is null)
- `POST` — upload a file via FormData, save to disk, create Attachment record

Key implementation details:
- Reuse the `getSessionAndMembership` pattern from `src/app/api/projects/[id]/tasks/[taskId]/route.ts`
- Validate file extension against allowed list: `pdf,doc,docx,xls,xlsx,ppt,pptx,csv,txt,png,jpg,jpeg,gif,svg`
- Validate file size ≤ 10MB
- Save file to `uploads/attachments/<projectId>/<taskId>/<cuid>-<originalName>`
- Create `uploads/attachments/<projectId>/<taskId>/` directory with `mkdir -p` (recursive) if it doesn't exist
- Use `crypto.randomUUID()` for the filename prefix
- Return the Attachment record with `uploadedBy` relation included

**Step 2: Create the single attachment delete route**

`src/app/api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]/route.ts`

Handles:
- `DELETE` — verify membership, verify attachment belongs to task, delete file from disk, delete DB record
- Only the uploader or ADMIN/MANAGER can delete

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/attachments/
git commit -m "feat: add attachments CRUD API"
```

---

### Task 4: Comments API Route

**Files:**
- Create: `src/app/api/projects/[id]/tasks/[taskId]/comments/route.ts`
- Create: `src/app/api/projects/[id]/tasks/[taskId]/comments/[commentId]/route.ts`

**Step 1: Create the comments list + create route**

`src/app/api/projects/[id]/tasks/[taskId]/comments/route.ts`

Handles:
- `GET` — list comments for a task, ordered by `createdAt asc`, include `author` (id, name, avatar) and `attachments` (with uploadedBy)
- `POST` — create comment via FormData. Fields: `body` (text, required), optional file(s). For each file: validate extension/size, save to disk, create Attachment record linked to both the comment and the task.

**Step 2: Create the single comment delete route**

`src/app/api/projects/[id]/tasks/[taskId]/comments/[commentId]/route.ts`

Handles:
- `DELETE` — verify membership, verify comment belongs to task, only author or ADMIN/MANAGER can delete. Delete all comment attachments (files + DB records), then delete the comment.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/comments/
git commit -m "feat: add comments CRUD API"
```

---

### Task 5: Refactor Task Detail — Sheet to Dialog (Two-Column Layout)

**Files:**
- Modify: `src/components/board/task-detail-dialog.tsx` (major rewrite)

**Step 1: Convert Sheet to Dialog with two-column layout**

Replace `Sheet`/`SheetContent`/`SheetHeader` imports with `Dialog`/`DialogContent`/`DialogHeader` from `@/components/ui/dialog`.

New layout structure:
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
    <DialogHeader className="px-6 pt-6 pb-0">
      {/* Title — large inline editable input */}
    </DialogHeader>

    <div className="flex flex-1 overflow-hidden">
      {/* Left column — scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {/* Description textarea */}
        {/* Attachments section (Task 6) */}
        {/* Comments section (Task 7) */}
      </div>

      {/* Right column — metadata sidebar */}
      <div className="w-56 shrink-0 border-l bg-muted/30 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Status, Priority, Type, Assignee, Story Points, Due Date */}
        {/* Delete button at bottom */}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

Key changes:
- Move all metadata fields (status, priority, type, assignee, story points, due date) into the right sidebar column
- Make metadata fields compact: use `Label` + `Select` pairs, tight spacing
- Remove the "Save Changes" button — auto-save on field change (call `onSave` when any field changes, debounced) OR keep explicit save. **Keep explicit save** for now — add a "Save" button in the header area next to the title.
- Move "Delete" to the bottom of the right sidebar
- Left column: description textarea, then placeholder divs for attachments and comments sections (wired in Tasks 6 & 7)

**Step 2: Update the `onSave` callback to include auto-save behavior**

Keep the existing save-on-button-press pattern but move the button to a less prominent position (footer of left column or header bar). The metadata sidebar fields should still update the local state; Save persists everything.

**Step 3: Verify build and visual check**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/board/task-detail-dialog.tsx
git commit -m "refactor: convert task detail from Sheet to Dialog with two-column layout"
```

---

### Task 6: Attachments Section Component

**Files:**
- Create: `src/components/board/task-attachments.tsx`
- Modify: `src/components/board/task-detail-dialog.tsx` (integrate)

**Step 1: Create the TaskAttachments component**

Props:
```typescript
interface TaskAttachmentsProps {
  projectId: string;
  taskId: string;
}
```

Features:
- Fetches attachments via `GET /api/projects/{projectId}/tasks/{taskId}/attachments` on mount
- Displays a grid of attachment cards:
  - **Images** (png/jpg/gif/svg): show thumbnail via `<img src="/api/files/{filePath}" />` with 64px height, rounded corners. Click opens the image URL in a new tab.
  - **Other files**: show a file type icon (from lucide: `FileText` for docs, `FileSpreadsheet` for excel, `File` for generic) + filename + size. Click downloads.
- "Add file" button: opens a hidden `<input type="file">`. Accepts the allowed extensions. On select, immediately uploads via POST FormData. Shows a small loading spinner on the card while uploading.
- Delete button (X) on hover for each attachment. Calls DELETE API. Optimistically removes from list.
- Drag-and-drop: Allow dropping files onto the attachments section area. Use the same `onDragOver`/`onDrop` pattern as `excel-upload.tsx`.
- Empty state: subtle dashed border area with "Drop files here or click to attach" text.

**Step 2: Integrate into task-detail-dialog.tsx**

In the left column, after description, add:
```tsx
<TaskAttachments projectId={projectId} taskId={task.id} />
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/board/task-attachments.tsx src/components/board/task-detail-dialog.tsx
git commit -m "feat: add attachments section to task detail modal"
```

---

### Task 7: Comments Section Component

**Files:**
- Create: `src/components/board/task-comments.tsx`
- Modify: `src/components/board/task-detail-dialog.tsx` (integrate)

**Step 1: Create the TaskComments component**

Props:
```typescript
interface TaskCommentsProps {
  projectId: string;
  taskId: string;
}
```

Features:
- Fetches comments via `GET /api/projects/{projectId}/tasks/{taskId}/comments` on mount
- Displays chronological list of comments. Each comment shows:
  - Avatar (using `<Avatar>` from shadcn) + author name + relative timestamp (use `formatDistanceToNow` from date-fns)
  - Plain text body
  - Attached files below the body (same display as TaskAttachments — thumbnails for images, icons for others)
  - Delete button on hover (only for author — compare `session.user.id` to `comment.authorId`, or ADMIN/MANAGER). Use `useSession` from next-auth/react.
- Comment input at the bottom:
  - A text input (or textarea) with placeholder "Write a comment..."
  - Paperclip icon button to attach files (opens file picker, can select multiple)
  - Send button (arrow icon). Disabled when body is empty and no files selected.
  - Shows selected files as small chips below the input before submitting
  - On submit: POST FormData with `body` field + file(s). On success, prepend/append to comment list and clear input.

**Step 2: Integrate into task-detail-dialog.tsx**

In the left column, after attachments:
```tsx
<TaskComments projectId={projectId} taskId={task.id} />
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/board/task-comments.tsx src/components/board/task-detail-dialog.tsx
git commit -m "feat: add comments section to task detail modal"
```

---

### Task 8: Final Integration & Polish

**Files:**
- Possibly modify: `src/components/board/kanban-board.tsx` (if props changed)
- Possibly modify: `src/components/board/task-detail-dialog.tsx` (cleanup)

**Step 1: Ensure TaskDetailDialog still receives all needed props**

If the refactored dialog no longer needs `columns` for the status dropdown (it should still need it), verify the parent `KanbanBoard` passes everything correctly.

**Step 2: Full build check**

```bash
npm run build
```

**Step 3: Manual test checklist**

- [ ] Click a task card → modal opens with two-column layout
- [ ] Edit title, description, metadata fields → Save works
- [ ] Upload a file via "Add file" → appears in attachments section
- [ ] Upload an image → thumbnail preview shows
- [ ] Click image thumbnail → opens in new tab
- [ ] Delete an attachment → removed from list
- [ ] Write a comment → appears in comment list
- [ ] Write a comment with file attachment → file shows in comment
- [ ] Delete a comment → removed with its attachments
- [ ] Drop a file onto the attachments area → uploads
- [ ] Close and reopen modal → data persists

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete task attachments and comments system"
```
