# Vercel Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy ProjectTracker prototype to Vercel + Neon + Vercel Blob at zero cost for client testing.

**Architecture:** Vercel hosts the Next.js app. Neon provides serverless PostgreSQL. Vercel Blob replaces local filesystem for file attachments. All free tiers.

**Tech Stack:** Vercel, Neon PostgreSQL, @vercel/blob, Prisma, Next.js 15

---

### Task 1: Install @vercel/blob

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install @vercel/blob`
Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `grep '"@vercel/blob"' package.json`
Expected: Shows `"@vercel/blob": "^x.x.x"` in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vercel/blob for cloud file storage"
```

---

### Task 2: Create blob storage helper

**Files:**
- Create: `src/lib/blob.ts`

**Step 1: Create the blob utility**

```typescript
// src/lib/blob.ts
import { put, del } from "@vercel/blob";

/**
 * Upload a file to Vercel Blob storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<{ url: string }> {
  const blob = await put(pathname, file, {
    access: "public",
  });
  return { url: blob.url };
}

/**
 * Delete a file from Vercel Blob storage by its URL.
 */
export async function deleteFromBlob(url: string): Promise<void> {
  await del(url);
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/blob.ts 2>&1 || echo "Check for errors"`

**Step 3: Commit**

```bash
git add src/lib/blob.ts
git commit -m "feat: add Vercel Blob storage helper"
```

---

### Task 3: Refactor attachment upload API (POST)

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts`

**Step 1: Replace filesystem imports and upload logic**

In `src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts`:

Remove these imports:
```typescript
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
```

Add this import:
```typescript
import { uploadToBlob } from "@/lib/blob";
```

**Step 2: Replace the file save block in POST handler**

Find this block (inside the POST function, after file validation):
```typescript
    // Save to disk
    const uuid = crypto.randomUUID();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const diskName = `${uuid}-${safeFileName}`;
    const relPath = path.join("attachments", id, taskId, diskName);
    const absDir = path.join(process.cwd(), "uploads", "attachments", id, taskId);
    const absPath = path.join(absDir, diskName);

    await mkdir(absDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);
```

Replace with:
```typescript
    // Upload to Vercel Blob
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `attachments/${id}/${taskId}/${safeFileName}`;
    const { url } = await uploadToBlob(file, pathname);
```

**Step 3: Update the DB record creation**

Find:
```typescript
        filePath: relPath,
```

Replace with:
```typescript
        filePath: url,
```

**Step 4: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors in this file

**Step 5: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/attachments/route.ts
git commit -m "refactor: use Vercel Blob for attachment uploads"
```

---

### Task 4: Refactor attachment delete API

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]/route.ts`

**Step 1: Replace filesystem imports**

Remove:
```typescript
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
```

Add:
```typescript
import { deleteFromBlob } from "@/lib/blob";
```

**Step 2: Replace file deletion logic**

Find:
```typescript
    // Delete file from disk
    const absPath = path.join(process.cwd(), "uploads", attachment.filePath);
    if (existsSync(absPath)) {
      await unlink(absPath);
    }
```

Replace with:
```typescript
    // Delete file from Vercel Blob
    if (attachment.filePath) {
      await deleteFromBlob(attachment.filePath);
    }
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]/route.ts
git commit -m "refactor: use Vercel Blob for attachment deletion"
```

---

### Task 5: Refactor comments API file uploads

**Files:**
- Modify: `src/app/api/projects/[id]/tasks/[taskId]/comments/route.ts`

**Step 1: Replace filesystem imports**

Remove:
```typescript
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
```

Add:
```typescript
import { uploadToBlob } from "@/lib/blob";
```

**Step 2: Replace file save loop in POST handler**

Find:
```typescript
    // Save files and create attachment records
    const attachmentData = [];
    for (const file of files) {
      const uuid = crypto.randomUUID();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const diskName = `${uuid}-${safeFileName}`;
      const relPath = path.join("attachments", id, taskId, diskName);
      const absDir = path.join(process.cwd(), "uploads", "attachments", id, taskId);
      const absPath = path.join(absDir, diskName);

      await mkdir(absDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(absPath, buffer);

      attachmentData.push({
        fileName: file.name,
        filePath: relPath,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        taskId,
        commentId: comment.id,
        uploadedById: session.user.id,
      });
    }
```

Replace with:
```typescript
    // Upload files to Vercel Blob and create attachment records
    const attachmentData = [];
    for (const file of files) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pathname = `attachments/${id}/${taskId}/${safeFileName}`;
      const { url } = await uploadToBlob(file, pathname);

      attachmentData.push({
        fileName: file.name,
        filePath: url,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        taskId,
        commentId: comment.id,
        uploadedById: session.user.id,
      });
    }
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/projects/[id]/tasks/[taskId]/comments/route.ts
git commit -m "refactor: use Vercel Blob for comment attachment uploads"
```

---

### Task 6: Update frontend to use Blob URLs directly

**Files:**
- Modify: `src/components/board/task-attachments.tsx`
- Modify: `src/components/board/task-comments.tsx`

**Step 1: Update task-attachments.tsx**

The `filePath` field now stores full Blob URLs instead of relative paths. Replace all `/api/files/${att.filePath}` references with just `att.filePath`.

In `src/components/board/task-attachments.tsx`, find every occurrence of:
```typescript
`/api/files/${att.filePath}`
```

Replace each with:
```typescript
att.filePath
```

There are 4 occurrences (2 for images as `href` and `src`, 2 for non-image files as `href`).

**Step 2: Update task-comments.tsx**

In `src/components/board/task-comments.tsx`, find every occurrence of:
```typescript
`/api/files/${att.filePath}`
```

Replace each with:
```typescript
att.filePath
```

There are 3 occurrences (lines ~281, ~287, ~295).

**Step 3: Verify compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/board/task-attachments.tsx src/components/board/task-comments.tsx
git commit -m "refactor: use direct Blob URLs for attachment display"
```

---

### Task 7: Remove the file serving API route

**Files:**
- Delete: `src/app/api/files/[...path]/route.ts`

**Step 1: Verify no other files reference this route**

Run: `grep -r "/api/files/" src/ --include="*.ts" --include="*.tsx" -l`
Expected: No results (we updated them all in Task 6)

**Step 2: Delete the route**

Run: `rm src/app/api/files/\[...path\]/route.ts && rmdir src/app/api/files/\[...path\] && rmdir src/app/api/files`

**Step 3: Verify the app still compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add -A src/app/api/files/
git commit -m "refactor: remove local file serving route (replaced by Vercel Blob URLs)"
```

---

### Task 8: Update environment config

**Files:**
- Modify: `.env.example`

**Step 1: Add Blob token to .env.example**

Add to `.env.example`:
```
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"
```

**Step 2: Update build script in package.json**

In `package.json`, change the `build` script from:
```json
"build": "next build",
```

To:
```json
"build": "prisma generate && prisma migrate deploy && next build",
```

This ensures Prisma schema is generated and migrations run on every Vercel deploy.

**Step 3: Commit**

```bash
git add .env.example package.json
git commit -m "chore: add Blob token to env example, update build for Vercel deploy"
```

---

### Task 9: Local development fallback

**Files:**
- Modify: `src/lib/blob.ts`

**Step 1: Add local fallback for development**

Replace `src/lib/blob.ts` with a version that works both locally and on Vercel:

```typescript
// src/lib/blob.ts
import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const useLocalStorage = !process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Upload a file to Vercel Blob (production) or local disk (development).
 * Returns the URL to access the uploaded file.
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<{ url: string }> {
  if (useLocalStorage) {
    const absDir = path.join(process.cwd(), "uploads", path.dirname(pathname));
    await mkdir(absDir, { recursive: true });
    const absPath = path.join(process.cwd(), "uploads", pathname);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);
    return { url: `/api/files/${pathname}` };
  }

  const blob = await put(pathname, file, { access: "public" });
  return { url: blob.url };
}

/**
 * Delete a file from Vercel Blob (production) or local disk (development).
 */
export async function deleteFromBlob(url: string): Promise<void> {
  if (useLocalStorage) {
    // Local URLs look like /api/files/attachments/...
    const relativePath = url.replace("/api/files/", "");
    const absPath = path.join(process.cwd(), "uploads", relativePath);
    try {
      await unlink(absPath);
    } catch {
      // File may not exist, ignore
    }
    return;
  }

  await del(url);
}
```

**Step 2: Restore the file serving route for local dev**

Since we deleted the `/api/files/` route in Task 7, we need it back for local development. Re-create `src/app/api/files/[...path]/route.ts` with the original content:

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
    if (segments.length < 4 || segments[0] !== "attachments") {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const projectId = segments[1];
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: session.user.id, projectId },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const uploadsRoot = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsRoot, ...segments);
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(uploadsRoot)) {
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

**Step 3: The frontend already handles both URL formats**

- Local dev: `filePath` = `/api/files/attachments/...` (served by local route)
- Vercel prod: `filePath` = `https://xyz.public.blob.vercel-storage.com/...` (served by Vercel Blob CDN)

Both are full URLs that work directly in `<a href>` and `<img src>`.

**Step 4: Verify compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/blob.ts src/app/api/files/
git commit -m "feat: add local dev fallback for file storage"
```

---

### Task 10: Test locally

**Step 1: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds (Prisma generate + next build)

**Step 2: Verify the app starts**

Run: `npm run dev`
Expected: App starts at localhost:3000

**Step 3: Manual test — upload an attachment**

1. Login as admin@projecttracker.com
2. Open a task on the Kanban board
3. Upload a file in the attachments section
4. Verify it uploads and displays (uses local storage since no BLOB_READ_WRITE_TOKEN)

**Step 4: Commit build fixes if any**

```bash
git add -A
git commit -m "fix: resolve build issues for Vercel deployment"
```

---

### Task 11: Deploy to Vercel

**Pre-requisites (done outside this plan, in Vercel dashboard + Neon dashboard):**

1. **Neon**: Create free project at neon.tech → copy connection string
2. **Vercel**: Connect GitHub repo at vercel.com → import project
3. **Vercel Blob**: In Vercel dashboard → Storage → Create Blob Store → copy token

**Step 1: Set environment variables in Vercel dashboard**

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste result |
| `NEXTAUTH_URL` | `https://your-app-name.vercel.app` |
| `BLOB_READ_WRITE_TOKEN` | Token from Vercel Blob store |

**Step 2: Push to trigger deploy**

```bash
git push origin feat/task-attachments-comments
```

Or merge to `main` first if Vercel is connected to `main`:

```bash
git checkout main
git merge feat/task-attachments-comments
git push origin main
```

**Step 3: Verify deploy succeeds**

Check Vercel dashboard for build logs. Expected: build succeeds, Prisma migrates, app is live.

**Step 4: Seed the production database**

Run locally with the Neon DATABASE_URL:

```bash
DATABASE_URL="postgresql://...@neon.tech/neondb?sslmode=require" npx tsx prisma/seed.ts
```

**Step 5: Manual smoke test on production**

1. Visit `https://your-app.vercel.app`
2. Login as admin@projecttracker.com / admin123
3. Navigate: Dashboard → Project → Board → click a task
4. Upload an attachment → verify it displays
5. Add a comment with attachment → verify it displays
6. Test all nav: Backlog, Reports, Data, Settings, Admin

**Step 6: Share URL with client for testing**
