# Vercel Deployment Design (Prototype Demo)

**Date**: 2026-03-04
**Status**: Approved
**Purpose**: Deploy prototype to Vercel for client testing. Zero cost.

## Architecture

```
Client Browser
     |
     v
Vercel (Next.js app, free hobby)
     |-- API Routes --> Neon PostgreSQL (free, 0.5GB)
     +-- File Uploads --> Vercel Blob (free, 250MB)
```

## Components

### App Hosting: Vercel (Free Hobby)

- Connect GitHub repo to Vercel
- Auto-detects Next.js App Router, zero config
- Auto-deploys on git push
- Build command: `npx prisma generate && npx prisma migrate deploy && next build`
- No vercel.json needed

### Database: Neon PostgreSQL (Free)

- 0.5GB storage (sufficient for prototype)
- Auto-suspends after 5 min inactivity (cold start ~1-2s)
- Connection pooling via `?pgbouncer=true` for serverless compatibility
- Uses `@prisma/adapter-neon` (already in dependencies)

### File Storage: Vercel Blob (Free)

- 250MB storage, 1GB bandwidth/month
- Replaces local `uploads/` directory
- Public URLs (acceptable for prototype demo — not sensitive documents)
- Signed URLs can be added later if bank requires auth-gated files

## Codebase Changes Required

1. **Add `@vercel/blob` package**
2. **Refactor attachment upload API** (`/api/projects/[id]/tasks/[taskId]/attachments`) — use `put()` from Vercel Blob instead of `fs.writeFile()`
3. **Refactor attachment delete** — use `del()` from Vercel Blob instead of `fs.unlink()`
4. **Store Blob URL** in `Attachment.filePath` (instead of local path)
5. **Remove `/api/files/[...path]` route** — Vercel Blob returns direct URLs, no self-serving needed
6. **Update build command** to include `prisma migrate deploy`

## No Changes To

- UI components, pages, layouts
- Authentication (NextAuth credentials)
- Prisma schema or models
- Any feature logic (Kanban, sprints, reports, etc.)

## Environment Variables (Vercel Dashboard)

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon dashboard (connection string with `?sslmode=require`) |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<app-name>.vercel.app` (assigned after first deploy) |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard > Storage > Blob |

## Seed Data

- 3 demo accounts: admin, manager, member
- 1 sample project with tasks across Kanban columns
- Seed by running `npx prisma db seed` locally with `DATABASE_URL` pointing to Neon
- No self-registration — controlled demo, accounts created by developer

## Cost

| Component | Cost |
|---|---|
| Vercel (hobby) | $0 |
| Neon (free) | $0 |
| Vercel Blob (free) | $0 |
| **Total** | **$0** |

## Limitations (Acceptable for Demo)

- Neon cold start ~1-2s after 5 min idle
- Blob URLs are public (not auth-gated)
- 0.5GB DB / 250MB files — sufficient for 5-15 test users
- Vercel hobby = no team preview URLs

## Note

This is a throwaway demo deployment. Production deployment will be different based on client preferences and security requirements.
