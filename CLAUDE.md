# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ProjectTracker — a Jira-like project management web app for a banking client proposal (5-15 users). Working prototype deliverable.

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

## Architecture

Single Next.js codebase: App Router (frontend) + API Routes (backend) + Prisma ORM + PostgreSQL. Containerized with Docker.

## Design Doc

Full design at `docs/plans/2026-03-03-project-tracker-design.md`
