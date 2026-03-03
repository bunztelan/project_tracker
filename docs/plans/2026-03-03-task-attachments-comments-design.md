# Task Attachments & Comments

## Overview

Add file attachments and comments to tasks. Files can be attached directly to a task (standalone) or embedded in a comment. The task detail view changes from a side drawer to a centered modal with a two-column layout.

## Data Models

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| fileName | String | Original filename |
| filePath | String | Server path relative to uploads root |
| fileSize | Int | Bytes |
| mimeType | String | e.g. `image/png`, `application/pdf` |
| taskId | String? | Set for standalone task attachments |
| commentId | String? | Set for comment-embedded attachments |
| uploadedById | String | FK → User |
| createdAt | DateTime | |

At least one of `taskId` or `commentId` must be set. When a file is attached via a comment, both are set (taskId for easy querying of all task files).

### Comment

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| body | String | Plain text |
| taskId | String | FK → Task |
| authorId | String | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: has many Attachments. Belongs to Task, User.

## File Storage

- **Location**: `uploads/attachments/<projectId>/<taskId>/<uuid>-<originalName>`
- **Serving**: Via `/api/files/[...path]` with project membership auth check
- **Allowed types**: `.pdf .doc .docx .xls .xlsx .ppt .pptx .csv .txt .png .jpg .jpeg .gif .svg`
- **Max size**: 10 MB per file
- **Cleanup**: Deleting an attachment also deletes the file from disk. Deleting a comment deletes its attachments and files.

## API Routes

### Attachments

| Method | Route | Body | Notes |
|--------|-------|------|-------|
| GET | `/api/projects/[id]/tasks/[taskId]/attachments` | — | List standalone task attachments |
| POST | `/api/projects/[id]/tasks/[taskId]/attachments` | FormData (file) | Upload standalone attachment |
| DELETE | `/api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]` | — | Delete attachment + file |

### Comments

| Method | Route | Body | Notes |
|--------|-------|------|-------|
| GET | `/api/projects/[id]/tasks/[taskId]/comments` | — | List comments with attachments |
| POST | `/api/projects/[id]/tasks/[taskId]/comments` | FormData (body + optional files) | Create comment |
| DELETE | `/api/projects/[id]/tasks/[taskId]/comments/[commentId]` | — | Delete comment + its attachments |

### File Serving

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/api/files/[...path]` | Streams file, checks project membership |

## UI: Task Detail Modal

Replace the current `Sheet` (side drawer) with a `Dialog` (centered modal, max-w-3xl).

### Layout

```
┌──────────────────────────────────────────────────────┐
│  [x]                                                 │
│  Task Title (inline editable)                        │
│                                                      │
│  ┌─── Main (left ~60%) ───┐  ┌── Sidebar (right) ──┐│
│  │ Description             │  │ Status    [Done ▾]  ││
│  │ (textarea)              │  │ Priority  [High ▾]  ││
│  │                         │  │ Type      [Bug  ▾]  ││
│  │ ── Attachments (2) ──  │  │ Assignee  [Alice ▾] ││
│  │ 🖼 thumb.png   📎 spec │  │ Points    [3]       ││
│  │ [+ Add file]           │  │ Due date  [Mar 10]  ││
│  │                         │  │ Sprint    [Sprint 1]││
│  │ ── Comments ──         │  │                     ││
│  │ Alice: looks good       │  │                     ││
│  │ Bob: updated mockup     │  │                     ││
│  │   📎 mockup.png         │  │                     ││
│  │ [Write a comment... 📎] │  │  [Delete task]      ││
│  └─────────────────────────┘  └─────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### Left Column — Content

1. **Description**: Existing textarea, inline editable.
2. **Attachments section**: Grid of cards. Images show thumbnail previews (click to open full-size). Non-image files show type icon + filename + size. "Add file" button opens file picker (or drag-and-drop). Delete button on hover.
3. **Comments section**: Chronological list. Each comment: avatar, name, relative timestamp, text body, optional file attachments. Input at bottom with paperclip icon to attach files.

### Right Column — Metadata

Compact sidebar with all existing fields: status, priority, type, assignee, story points, due date, sprint. Delete task button at bottom.

### Attachment Display Rules

- **Images** (png, jpg, gif, svg): Show thumbnail (64x64 or similar), click to view full-size in browser tab
- **Other files**: Show file type icon + filename + size, click to download
- **Delete**: X button on hover, only visible to uploader or ADMIN/MANAGER

### Comment Display

- Avatar + author name + relative time ("2 hours ago")
- Plain text body
- Attached files shown below the text (same display rules as standalone attachments)
- Delete button on hover (only for comment author or ADMIN/MANAGER)

## Constraints

- 10 MB per file
- Allowed extensions only (validated client + server)
- Project membership required for all operations
- Any member can upload/comment; only uploader/author or ADMIN/MANAGER can delete
