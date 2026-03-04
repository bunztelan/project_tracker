# Planowiz SaaS Transformation Design

**Date:** 2026-03-04
**Status:** Approved
**Approach:** Incremental migration (Phase-by-phase on existing codebase)
**Priority:** Bank client delivery first, then SaaS pivot

## Key Decisions

- **Multi-tenancy:** Shared DB + tenant column (`organizationId`)
- **Payment provider:** Midtrans (Indonesian provider, IDR pricing)
- **Auth:** Email/password only (social login deferred)
- **Landing page:** Same Next.js app (public routes)
- **Approach:** Incremental — 6 phases, each independently deployable

---

## Phase 1: Multi-Tenancy — Organization Model

### New Models

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique  // URL-friendly, e.g. "acme-corp"
  logo      String?
  plan      Plan     @default(FREE)
  planExpiresAt  DateTime?
  trialEndsAt    DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      OrganizationMember[]
  projects     Project[]
  subscription Subscription?
  invites      PendingInvite[]
  payments     PaymentHistory[]
}

model OrganizationMember {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           OrgRole  @default(MEMBER)
  invitedAt      DateTime @default(now())
  joinedAt       DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

enum Plan {
  FREE
  STARTER
  PRO
}
```

### Changes to Existing Models

- `Project` gets `organizationId` (required) — foreign key to Organization
- `User` gets `organizations` relation via OrganizationMember
- Keep existing `ProjectMember` for project-level access within an org

### Data Access Pattern

- Prisma middleware auto-filters all queries by `organizationId` from session
- Session JWT includes `activeOrganizationId` and `organizationRole`
- Org switcher in sidebar header (like Slack workspace switcher)

### Migration for Bank Client

- Auto-create one Organization for existing data
- Attach all existing projects and users to it
- Bank client org gets `PRO` plan with no billing (custom deal)

---

## Phase 2: Self-Serve Signup & Onboarding

### Signup Flow

1. User visits `/signup`
2. Enters: name, email, password, organization name
3. System creates: User + Organization (plan: FREE) + OrganizationMember (role: OWNER)
4. Auto-creates a demo project with sample tasks (reuse seed logic)
5. Redirects to `/dashboard` with onboarding checklist

### Onboarding Checklist (Dismissible Banner)

- Create your first project
- Invite a team member
- Create your first task
- Set up your board

### Team Invitations

```prisma
model PendingInvite {
  id             String   @id @default(cuid())
  email          String
  organizationId String
  role           OrgRole  @default(MEMBER)
  token          String   @unique @default(cuid())
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([email])
  @@index([token])
}
```

- Org OWNER/ADMIN can invite by email from project settings
- Invite link: `/invite/[token]`
- If user exists → add to org. If not → signup form pre-filled with email
- Invites expire in 7 days
- No email verification initially — add later if spam becomes an issue

---

## Phase 3: Subscription Tiers & Feature Gating

### Tier Limits

| | Free | Starter | Pro |
|---|---|---|---|
| **Price** | Rp 0 | Rp 29k/user/mo | Rp 59k/user/mo |
| **Max Users** | 3 | 15 | 50 |
| **Max Projects** | 1 | 5 | Unlimited |
| **Features** | Board, Backlog | + Sprints, Timeline | + Reports, Excel, API |
| **Storage** | 100 MB | 1 GB | 10 GB |
| **Support** | Community | Email | Priority |

### Tier Configuration (Code-Level)

```typescript
const TIER_LIMITS = {
  FREE:    { maxUsers: 3,  maxProjects: 1,  maxStorageMB: 100,   features: ['kanban_board', 'backlog'] },
  STARTER: { maxUsers: 15, maxProjects: 5,  maxStorageMB: 1024,  features: ['kanban_board', 'backlog', 'sprint_planning', 'gantt_timeline'] },
  PRO:     { maxUsers: 50, maxProjects: -1, maxStorageMB: 10240, features: ['kanban_board', 'backlog', 'sprint_planning', 'gantt_timeline', 'reports', 'excel_visualization'] },
} as const;
```

### Enforcement Points

- `POST /api/projects` → check project count vs tier limit
- `POST /api/projects/[id]/members` → check user count vs tier limit
- `POST /api/projects/[id]/attachments` → check storage usage vs tier limit
- Feature toggle routes → check feature key vs tier's allowed features

### Upgrade Prompts

- Friendly upgrade modal (not a hard error) when hitting a limit
- "You've reached the 1-project limit on the Free plan. Upgrade to Starter for up to 5 projects."
- Link directly to `/settings/billing`

### Feature Toggle Integration

- Existing per-project toggles remain for customization
- Tier-level gating acts as a ceiling — can't enable features the tier doesn't include
- On upgrade, newly available features auto-enable for existing projects

---

## Phase 4: Billing — Midtrans Integration

### New Models

```prisma
model Subscription {
  id                      String             @id @default(cuid())
  organizationId          String             @unique
  tier                    Plan               @default(FREE)
  status                  SubscriptionStatus @default(ACTIVE)
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime
  midtransOrderId         String?
  midtransTransactionId   String?
  midtransSubscriptionId  String?
  cancelledAt             DateTime?
  cancelReason            String?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model PaymentHistory {
  id                      String        @id @default(cuid())
  organizationId          String
  amount                  Int           // in IDR (smallest unit)
  currency                String        @default("IDR")
  status                  PaymentStatus
  midtransTransactionId   String?
  midtransPaymentType     String?       // bank_transfer, gopay, credit_card, etc.
  paidAt                  DateTime?
  metadata                Json?
  createdAt               DateTime      @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}
```

### Payment Flow

1. User selects plan on `/settings/billing`
2. Backend creates Midtrans Snap transaction (server-to-server)
3. Frontend opens Midtrans Snap popup (embedded payment UI)
4. User pays via bank transfer / e-wallet / credit card
5. Midtrans sends webhook to `/api/webhooks/midtrans`
6. Webhook handler updates Subscription status + creates PaymentHistory
7. Org `plan` field updated → tier limits recalculated

### Recurring Billing

- Midtrans Subscriptions API for monthly recurring
- Monthly charge on `currentPeriodEnd`
- Failed payment → status: `PAST_DUE` → 3-day grace period → downgrade to FREE

### Billing Settings Page (`/settings/billing`)

- Current plan display with usage meters (users, projects, storage)
- Plan comparison table
- Upgrade/downgrade buttons
- Payment history table
- Cancel subscription option

---

## Phase 5: Landing Page & Public Routes

### New Routes

```
/              → Landing page
/pricing       → Pricing comparison table
/login         → Existing login (+ link to signup)
/signup        → New signup form
/invite/[token] → Invitation acceptance
```

### Landing Page Sections

1. **Hero** — "Project management that your team will actually enjoy" + CTA (Get Started Free / See Pricing)
2. **Features grid** — 6 cards: Kanban Board, Sprint Planning, Gantt Timeline, Reports, Excel Viz, Team Collaboration
3. **Screenshot/demo** — Animated GIF or screenshot of Kanban board
4. **Pricing preview** — Summary of 3 tiers with "See full comparison" link
5. **Footer** — Links, social, "Built in Indonesia" badge

### Design Direction

Same Monday.com-inspired aesthetic — colorful, spacious, rounded corners. Consistent with the app.

### SEO

- Meta tags, Open Graph images
- `sitemap.xml`, `robots.txt` allowing public pages

---

## Phase 6: Infrastructure & Deployment

### New Environment Variables

```
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_WEBHOOK_SECRET=...
APP_URL=https://planowiz.com
```

### Docker

- `docker-compose.yml` with: Next.js app, PostgreSQL, Redis (rate limiting)
- Separate `Dockerfile` for production build
- Health check endpoint: `GET /api/health`

### Rate Limiting

- Redis-based (or in-memory for small scale)
- Limits per tier:
  - Free: 100 req/min
  - Starter: 500 req/min
  - Pro: 2000 req/min

### Monitoring

- Health check endpoint
- Error logging (console-based initially, Sentry later)
- Usage metrics stored in DB for billing dashboard

---

## SaaS Transformation Checklist

### Phase 1: Multi-Tenancy
- [ ] Create `Organization` and `OrganizationMember` models
- [ ] Add `organizationId` to `Project` model
- [ ] Add `Plan` and `OrgRole` enums
- [ ] Create Prisma middleware for tenant-scoped queries
- [ ] Update session JWT to include `activeOrganizationId` and `organizationRole`
- [ ] Add org switcher to sidebar
- [ ] Update all API routes to scope by organization
- [ ] Create migration script for existing bank client data
- [ ] Update `getSessionAndMembership()` to check org membership

### Phase 2: Self-Serve Signup
- [ ] Create `/signup` page with form (name, email, password, org name)
- [ ] Create signup API route (`POST /api/auth/signup`)
- [ ] Auto-create User + Organization + OrganizationMember on signup
- [ ] Auto-create demo project with sample tasks for new orgs
- [ ] Create `PendingInvite` model
- [ ] Build invite flow: send invite → accept invite → join org
- [ ] Create `/invite/[token]` page
- [ ] Add onboarding checklist banner on dashboard
- [ ] Add "Invite team member" UI in project settings

### Phase 3: Subscription Tiers
- [ ] Define `TIER_LIMITS` configuration constant
- [ ] Create enforcement middleware for project/member/storage limits
- [ ] Gate feature toggles by tier (tier as ceiling)
- [ ] Auto-enable features on tier upgrade
- [ ] Create upgrade prompt modal component
- [ ] Add usage counters (projects, members, storage per org)
- [ ] Update feature toggle page to show tier restrictions

### Phase 4: Billing (Midtrans)
- [ ] Create `Subscription` and `PaymentHistory` models
- [ ] Add `SubscriptionStatus` and `PaymentStatus` enums
- [ ] Install Midtrans Node.js SDK
- [ ] Create Midtrans Snap integration (create transaction)
- [ ] Create `/api/webhooks/midtrans` webhook handler
- [ ] Implement subscription creation on payment success
- [ ] Implement recurring billing via Midtrans Subscriptions API
- [ ] Handle failed payments (grace period → downgrade)
- [ ] Build `/settings/billing` page with plan selector and payment history
- [ ] Add usage meters to billing page

### Phase 5: Landing Page
- [ ] Create public route group `(public)` in App Router
- [ ] Build landing page (`/`) with hero, features, pricing preview, footer
- [ ] Build pricing page (`/pricing`) with tier comparison table
- [ ] Update `/login` page with link to signup
- [ ] Add meta tags and Open Graph images
- [ ] Create `sitemap.xml` and `robots.txt`
- [ ] Ensure consistent Monday.com-inspired design

### Phase 6: Infrastructure
- [ ] Create `Dockerfile` for production build
- [ ] Create `docker-compose.yml` (app + PostgreSQL + Redis)
- [ ] Add health check endpoint (`GET /api/health`)
- [ ] Implement rate limiting middleware (per-tier limits)
- [ ] Add Redis for rate limit storage
- [ ] Set up error logging (Sentry or console)
- [ ] Store usage metrics in DB for billing dashboard
- [ ] Create data migration script (existing data → Organization)
- [ ] Set up Midtrans sandbox for testing
- [ ] Configure production environment variables

### Post-Launch
- [ ] Add email verification (if spam becomes an issue)
- [ ] Add Google OAuth signup
- [ ] Add Sentry error monitoring
- [ ] Add API key authentication (for Pro tier)
- [ ] Add audit logging
- [ ] Add webhook notifications (for integrations)
