# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ProjectTracker — a project management web app for a banking client proposal (5-15 users). Working prototype deliverable.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (credentials provider, JWT sessions)
- **Excel parsing:** SheetJS (xlsx)
- **Charts:** Recharts
- **Drag & drop:** @dnd-kit
- **Validation:** Zod
- **Notifications:** Sonner (toast)
- **Testing:** Vitest, React Testing Library, Playwright
- **Deployment:** Docker + Docker Compose (cloud or self-hosted)

## Key Features

- Kanban board with drag-and-drop
- Backlog management
- Sprint planning
- Gantt chart / timeline view
- Reporting dashboards (burndown, velocity)
- Excel upload + flexible data visualization
- Feature toggle system (per project)
- Role-based access (Admin, Manager, Member)

## UI Direction

Monday.com-inspired — **NOT Jira**. Client explicitly dislikes Jira's UI. Follow these rules for ALL UI work:
- Colorful & visual: vibrant status colors, colored priority badges, progress bars
- Spacious & clean: generous whitespace, no dense tables
- Friendly & approachable: rounded-xl corners, soft shadows, smooth transitions (150-200ms)
- Minimal clicks: inline editing, hover-to-reveal actions
- AVOID: dense enterprise tables, deep nested menus, gray/corporate palette, cluttered toolbars

## Architecture

Single Next.js codebase: App Router (frontend) + API Routes (backend) + Prisma ORM + PostgreSQL. Containerized with Docker.

## Commit Messages

- Short and simple, no Co-Authored-By line
- Format: `type: brief description` (e.g. `fix: avatar sizing`, `feat: dashboard redesign`)
- Types: feat, fix, refactor, chore, docs, style, test

## Design Doc

Full design at `docs/plans/2026-03-03-project-tracker-design.md`
