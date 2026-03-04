# SaaS Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-tenancy (Organization model), team invitations, and Docker deployment to Planowiz — scoped for bank client delivery.

**Architecture:** Shared DB with `organizationId` tenant column. Organizations own projects. Users belong to organizations via OrganizationMember. Invitations via token-based PendingInvite model. Docker Compose for deployment.

**Tech Stack:** Prisma ORM (schema changes), NextAuth.js (session extension), Next.js API Routes, shadcn/ui (org switcher), Docker + PostgreSQL

**Design doc:** `docs/plans/2026-03-04-saas-transformation-design.md`

---

### Task 1: Add Organization models to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums and Organization model to schema**

Add these enums and models after the existing `WidgetType` enum (line 42) and before the `User` model (line 44):

```prisma
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

Add this model after the `User` model (after line 62):

```prisma
model Organization {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  logo          String?
  plan          Plan     @default(FREE)
  planExpiresAt DateTime?
  trialEndsAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  members  OrganizationMember[]
  projects Project[]
  invites  PendingInvite[]
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

**Step 2: Add organizationId to Project model**

In the `Project` model (currently line 64-82), add `organizationId` field and the relation:

Change the Project model to:
```prisma
model Project {
  id             String          @id @default(cuid())
  name           String
  description    String?
  key            String          @unique
  status         String          @default("active")
  ownerId        String
  organizationId String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  owner          User            @relation(fields: [ownerId], references: [id])
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  boards         Board[]
  tasks          Task[]
  sprints        Sprint[]
  featureToggles FeatureToggle[]
  excelUploads   ExcelUpload[]
  dashboards     Dashboard[]
  members        ProjectMember[]

  @@index([organizationId])
}
```

**Step 3: Add organizations relation to User model**

In the `User` model, add a relation to OrganizationMember. Add this line after `assignedSubtasks` (line 61):

```prisma
  organizationMembers OrganizationMember[]
```

**Step 4: Generate Prisma client (do NOT push yet)**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Organization, OrganizationMember, PendingInvite models"
```

---

### Task 2: Create data migration script

**Files:**
- Create: `prisma/migrations/add-organization.ts`

This script creates a default Organization for existing data, links all projects and users to it.

**Step 1: Write the migration script**

```typescript
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting organization migration...");

  // 1. Check if any organizations exist already
  const existingOrgs = await prisma.organization.count();
  if (existingOrgs > 0) {
    console.log("Organizations already exist. Skipping migration.");
    return;
  }

  // 2. Create default organization
  const org = await prisma.organization.create({
    data: {
      name: "Default Organization",
      slug: "default",
      plan: "PRO", // Bank client gets PRO
    },
  });
  console.log(`  Created organization: ${org.name} (${org.id})`);

  // 3. Link all existing projects to this organization
  const projectResult = await prisma.project.updateMany({
    where: { organizationId: "" }, // Projects without org (won't match after migration)
    data: { organizationId: org.id },
  });

  // Fallback: update ALL projects that don't have an org yet
  // Since organizationId is new, we need raw SQL or update each
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const project of projects) {
    await prisma.project.update({
      where: { id: project.id },
      data: { organizationId: org.id },
    });
  }
  console.log(`  Linked ${projects.length} projects to organization`);

  // 4. Add all existing users as organization members
  const users = await prisma.user.findMany({
    select: { id: true, role: true },
  });

  for (const user of users) {
    // Map global role to org role
    const orgRole = user.role === "ADMIN" ? "OWNER" : user.role === "MANAGER" ? "ADMIN" : "MEMBER";

    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: org.id,
        role: orgRole as "OWNER" | "ADMIN" | "MEMBER",
      },
    });
  }
  console.log(`  Added ${users.length} users as organization members`);

  console.log("Organization migration complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Migration failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Step 2: Push schema to database**

Run: `npx prisma db push`

Note: This will fail if there are existing projects without organizationId. If so, you need to:
1. First make `organizationId` optional in schema temporarily
2. Push schema
3. Run migration script
4. Make `organizationId` required again
5. Push schema again

Safer approach — make organizationId optional initially:

In schema.prisma, temporarily change:
```prisma
organizationId String?
```

Run: `npx prisma db push`
Run: `npx tsx prisma/migrations/add-organization.ts`

Then change back to required:
```prisma
organizationId String
```

Run: `npx prisma db push`

**Step 3: Commit**

```bash
git add prisma/migrations/add-organization.ts prisma/schema.prisma
git commit -m "feat: add organization data migration script"
```

---

### Task 3: Update seed.ts to create default organization

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Update seed to create Organization before Project**

After the user creation block (after line 50 `console.log("Created users:...)`), add:

```typescript
  // ── 1b. Default Organization ─────────────────────────────────────
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Organization",
      slug: "demo-org",
      plan: "PRO",
    },
  });

  console.log("  Created organization:", defaultOrg.name);

  // ── 1c. Organization Members ─────────────────────────────────────
  const orgMembers = [
    { userId: admin.id, role: "OWNER" as const },
    { userId: manager.id, role: "ADMIN" as const },
    { userId: member.id, role: "MEMBER" as const },
  ];

  for (const om of orgMembers) {
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: { userId: om.userId, organizationId: defaultOrg.id },
      },
      update: {},
      create: {
        userId: om.userId,
        organizationId: defaultOrg.id,
        role: om.role,
      },
    });
  }

  console.log("  Added organization members");
```

Then update the project creation (around line 53-62) to include `organizationId`:

```typescript
  const project = await prisma.project.upsert({
    where: { key: "DEMO" },
    update: {},
    create: {
      name: "Demo Project",
      description: "A demo project to explore ProjectTracker features",
      key: "DEMO",
      ownerId: admin.id,
      organizationId: defaultOrg.id,
    },
  });
```

**Step 2: Verify seed runs**

Run: `npx prisma db push && npx tsx prisma/seed.ts`
Expected: Seed completes successfully with "Created organization: Demo Organization"

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed to create default organization"
```

---

### Task 4: Extend NextAuth session with organization context

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

**Step 1: Update NextAuth type declarations**

Replace contents of `src/types/next-auth.d.ts`:

```typescript
import { type Role, type OrgRole, type Plan } from "@/generated/prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      activeOrganizationId: string | null;
      organizationRole: OrgRole | null;
      organizationPlan: Plan | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    activeOrganizationId: string | null;
    organizationRole: OrgRole | null;
    organizationPlan: Plan | null;
  }
}
```

**Step 2: Update auth.ts JWT and session callbacks**

Replace `src/lib/auth.ts` with:

```typescript
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Refresh role + org context from DB
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
        }

        // If no active org set yet, pick the user's first org
        if (!token.activeOrganizationId) {
          const firstOrgMembership = await prisma.organizationMember.findFirst({
            where: { userId: token.id as string },
            include: { organization: { select: { id: true, plan: true } } },
            orderBy: { joinedAt: "asc" },
          });
          if (firstOrgMembership) {
            token.activeOrganizationId = firstOrgMembership.organizationId;
            token.organizationRole = firstOrgMembership.role;
            token.organizationPlan = firstOrgMembership.organization.plan;
          } else {
            token.activeOrganizationId = null;
            token.organizationRole = null;
            token.organizationPlan = null;
          }
        } else {
          // Refresh org role and plan
          const orgMembership = await prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: token.id as string,
                organizationId: token.activeOrganizationId,
              },
            },
            include: { organization: { select: { plan: true } } },
          });
          if (orgMembership) {
            token.organizationRole = orgMembership.role;
            token.organizationPlan = orgMembership.organization.plan;
          } else {
            // User no longer in this org — clear
            token.activeOrganizationId = null;
            token.organizationRole = null;
            token.organizationPlan = null;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.activeOrganizationId = token.activeOrganizationId;
        session.user.organizationRole = token.organizationRole;
        session.user.organizationPlan = token.organizationPlan;
      }
      return session;
    },
  },
};
```

**Step 3: Verify the app compiles**

Run: `npx next build`
Expected: Build succeeds (or at least no TypeScript errors in auth files)

**Step 4: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat: extend NextAuth session with organization context"
```

---

### Task 5: Add organization-scoped API utilities

**Files:**
- Modify: `src/lib/api-utils.ts`

**Step 1: Add org-scoped helper functions**

Replace `src/lib/api-utils.ts` with:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export async function getSessionAndMembership(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  });

  return { session, membership };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: "Unauthorized" as const };
  }
  if (session.user.role !== Role.ADMIN) {
    return { session: null, error: "Forbidden" as const };
  }
  return { session, error: null };
}

/**
 * Get session with active organization context.
 * Returns null session if user is not authenticated or has no active org.
 */
export async function getSessionWithOrg() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, organizationId: null };
  }

  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    return { session, organizationId: null };
  }

  return { session, organizationId };
}

/**
 * Verify the project belongs to the user's active organization.
 * Returns session, membership, and organizationId if valid.
 */
export async function getSessionMembershipAndOrg(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null, organizationId: null };
  }

  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    return { session, membership: null, organizationId: null };
  }

  // Verify project belongs to the active org AND user is a project member
  const [project, membership] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    }),
    prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    }),
  ]);

  if (!project) {
    return { session, membership: null, organizationId };
  }

  return { session, membership, organizationId };
}
```

**Step 2: Commit**

```bash
git add src/lib/api-utils.ts
git commit -m "feat: add organization-scoped API utility helpers"
```

---

### Task 6: Update Project list/create API to scope by organization

**Files:**
- Modify: `src/app/api/projects/route.ts`

**Step 1: Update GET to filter by active organization**

In the GET handler, after getting the session, add org scoping. The current query fetches projects where user is a member. Add an additional filter for `organizationId`:

Find the `prisma.project.findMany` call in GET and add `organizationId` to the where clause:

```typescript
where: {
  members: { some: { userId: session.user.id } },
  ...(session.user.activeOrganizationId
    ? { organizationId: session.user.activeOrganizationId }
    : {}),
},
```

**Step 2: Update POST to include organizationId**

In the POST handler, when creating the project inside the transaction, add `organizationId`:

Find the `prisma.project.create` call and add:

```typescript
organizationId: session.user.activeOrganizationId!,
```

Also add a guard at the top of the POST handler after session check:

```typescript
if (!session.user.activeOrganizationId) {
  return NextResponse.json(
    { data: null, error: "no_organization", message: "No active organization" },
    { status: 400 }
  );
}
```

**Step 3: Verify the app compiles**

Run: `npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/projects/route.ts
git commit -m "feat: scope project list/create by active organization"
```

---

### Task 7: Add organization switcher API route

**Files:**
- Create: `src/app/api/organizations/route.ts`
- Create: `src/app/api/organizations/switch/route.ts`

**Step 1: Create organizations list endpoint**

Create `src/app/api/organizations/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    logo: m.organization.logo,
    plan: m.organization.plan,
    role: m.role,
  }));

  return NextResponse.json({
    data: organizations,
    error: null,
    message: "Organizations retrieved",
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/organizations/route.ts
git commit -m "feat: add organizations list API endpoint"
```

---

### Task 8: Add organization switcher UI to sidebar

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

**Step 1: Add org switcher to sidebar header**

This replaces the static "Planowiz" brand header with an org-aware header that shows the current org and allows switching (if user has multiple orgs).

In `app-sidebar.tsx`, add state and fetch for organizations. After the existing imports, add:

```typescript
import { Building2, Check } from "lucide-react";
```

Inside the component, add state for organizations:

```typescript
const [organizations, setOrganizations] = useState<
  Array<{ id: string; name: string; slug: string; plan: string; role: string }>
>([]);

useEffect(() => {
  fetch("/api/organizations")
    .then((res) => res.json())
    .then((data) => {
      if (data.data) setOrganizations(data.data);
    })
    .catch(() => {});
}, []);
```

Then in the SidebarHeader section, after the Planowiz brand link, add a small org indicator (only if user has orgs). If user has only 1 org, show it as a static label. If multiple, show a dropdown:

```tsx
{/* Organization indicator */}
{!isCollapsed && organizations.length > 0 && (
  <div className="mt-1 flex items-center gap-1.5 px-1">
    <Building2 className="h-3 w-3 text-muted-foreground" />
    <span className="text-[10px] font-medium text-muted-foreground truncate">
      {organizations.find(o => o.id === session?.user?.activeOrganizationId)?.name ?? organizations[0]?.name}
    </span>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat: add organization indicator to sidebar"
```

---

### Task 9: Update project layout to verify org ownership

**Files:**
- Modify: `src/app/(authenticated)/projects/[id]/layout.tsx`

**Step 1: Add organization verification to project layout**

In the project layout, after fetching the project and membership, add a check that the project belongs to the user's active organization:

After the `Promise.all` block (line 26-44), add:

```typescript
  // Verify project belongs to user's active org
  const activeOrgId = session.user.activeOrganizationId;
  if (activeOrgId && project && project.organizationId !== activeOrgId) {
    notFound();
  }
```

This requires adding `organizationId` to the project select. Update the select in `prisma.project.findUnique`:

```typescript
select: {
  id: true,
  name: true,
  key: true,
  description: true,
  organizationId: true,
},
```

**Step 2: Commit**

```bash
git add src/app/(authenticated)/projects/[id]/layout.tsx
git commit -m "feat: verify project org ownership in layout"
```

---

### Task 10: Create invitation API routes

**Files:**
- Create: `src/app/api/organizations/[orgId]/invites/route.ts`

**Step 1: Create invites list and create endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN in this org
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { data: null, error: "forbidden", message: "Only org admins can view invites" },
      { status: 403 }
    );
  }

  const invites = await prisma.pendingInvite.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: invites,
    error: null,
    message: "Invites retrieved",
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN in this org
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { data: null, error: "forbidden", message: "Only org admins can create invites" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "validation", message: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: orgId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { data: null, error: "conflict", message: "User is already a member of this organization" },
        { status: 409 }
      );
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.pendingInvite.findFirst({
    where: { email, organizationId: orgId },
  });

  if (existingInvite) {
    return NextResponse.json(
      { data: null, error: "conflict", message: "An invite has already been sent to this email" },
      { status: 409 }
    );
  }

  const invite = await prisma.pendingInvite.create({
    data: {
      email,
      organizationId: orgId,
      role: role as "ADMIN" | "MEMBER",
      expiresAt: addDays(new Date(), 7),
    },
  });

  return NextResponse.json(
    { data: invite, error: null, message: "Invite created" },
    { status: 201 }
  );
}
```

**Step 2: Commit**

```bash
git add src/app/api/organizations/[orgId]/invites/route.ts
git commit -m "feat: add organization invite create/list API"
```

---

### Task 11: Create invite deletion and acceptance API routes

**Files:**
- Create: `src/app/api/organizations/[orgId]/invites/[inviteId]/route.ts`
- Create: `src/app/api/invites/[token]/route.ts`

**Step 1: Create invite delete endpoint**

Create `src/app/api/organizations/[orgId]/invites/[inviteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const { orgId, inviteId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { data: null, error: "forbidden", message: "Only org admins can delete invites" },
      { status: 403 }
    );
  }

  await prisma.pendingInvite.delete({
    where: { id: inviteId },
  });

  return NextResponse.json({
    data: null,
    error: null,
    message: "Invite deleted",
  });
}
```

**Step 2: Create invite acceptance endpoint**

Create `src/app/api/invites/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch invite details (public, for showing invite info before login)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Invite not found or expired" },
      { status: 404 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { data: null, error: "expired", message: "This invite has expired" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    data: {
      email: invite.email,
      organizationName: invite.organization.name,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
    error: null,
    message: "Invite found",
  });
}

// POST: Accept the invite (requires authenticated user)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Please log in to accept this invite" },
      { status: 401 }
    );
  }

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Invite not found" },
      { status: 404 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { data: null, error: "expired", message: "This invite has expired" },
      { status: 410 }
    );
  }

  // Verify the invite email matches the logged-in user
  if (invite.email !== session.user.email) {
    return NextResponse.json(
      { data: null, error: "email_mismatch", message: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existing = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invite.organizationId,
      },
    },
  });

  if (existing) {
    // Already a member — delete invite and return success
    await prisma.pendingInvite.delete({ where: { id: invite.id } });
    return NextResponse.json({
      data: { organizationId: invite.organizationId },
      error: null,
      message: "You are already a member of this organization",
    });
  }

  // Add user to organization and delete invite
  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        userId: session.user.id,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    }),
    prisma.pendingInvite.delete({ where: { id: invite.id } }),
  ]);

  return NextResponse.json({
    data: { organizationId: invite.organizationId },
    error: null,
    message: "Successfully joined the organization",
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/organizations/[orgId]/invites/[inviteId]/route.ts src/app/api/invites/[token]/route.ts
git commit -m "feat: add invite deletion and acceptance API routes"
```

---

### Task 12: Create invite acceptance page

**Files:**
- Create: `src/app/invite/[token]/page.tsx`

**Step 1: Create the invite acceptance page**

This page is accessible without auth (shows invite info) but requires login to accept.

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InviteClient } from "./invite-client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite) {
    notFound();
  }

  const expired = invite.expiresAt < new Date();
  const session = await getServerSession(authOptions);

  return (
    <InviteClient
      token={token}
      organizationName={invite.organization.name}
      email={invite.email}
      role={invite.role}
      expired={expired}
      isLoggedIn={!!session?.user}
      loggedInEmail={session?.user?.email ?? null}
    />
  );
}
```

**Step 2: Create the invite client component**

Create `src/app/invite/[token]/invite-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface InviteClientProps {
  token: string;
  organizationName: string;
  email: string;
  role: string;
  expired: boolean;
  isLoggedIn: boolean;
  loggedInEmail: string | null;
}

export function InviteClient({
  token,
  organizationName,
  email,
  role,
  expired,
  isLoggedIn,
  loggedInEmail,
}: InviteClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const emailMismatch = isLoggedIn && loggedInEmail !== email;

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message);
        return;
      }

      setAccepted(true);
      toast.success("Welcome! You've joined the organization.");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Card className="w-full max-w-md rounded-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 shadow-lg">
            {accepted ? (
              <CheckCircle2 className="h-8 w-8 text-white" />
            ) : expired ? (
              <AlertCircle className="h-8 w-8 text-white" />
            ) : (
              <UserPlus className="h-8 w-8 text-white" />
            )}
          </div>
          <CardTitle className="text-xl">
            {accepted
              ? "You're in!"
              : expired
                ? "Invite Expired"
                : "You've been invited"}
          </CardTitle>
          <CardDescription>
            {accepted
              ? `You've joined ${organizationName}`
              : expired
                ? "This invitation link has expired. Ask your team admin for a new one."
                : `Join ${organizationName} on Planowiz`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!expired && !accepted && (
            <>
              <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{organizationName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
                </div>
              </div>

              {!isLoggedIn ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Log in to accept this invitation
                  </p>
                  <Button asChild className="w-full rounded-xl">
                    <Link href={`/login?callbackUrl=/invite/${token}`}>
                      Log in to accept
                    </Link>
                  </Button>
                </div>
              ) : emailMismatch ? (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 text-center">
                    This invite was sent to <strong>{email}</strong>, but you're logged in as <strong>{loggedInEmail}</strong>.
                    Please log in with the invited email.
                  </p>
                  <Button asChild variant="outline" className="w-full rounded-xl">
                    <Link href={`/login?callbackUrl=/invite/${token}`}>
                      Switch account
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600"
                >
                  {accepting ? "Joining..." : "Accept Invite"}
                </Button>
              )}
            </>
          )}

          {accepted && (
            <Button asChild className="w-full rounded-xl">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Add /invite route to middleware exceptions**

In `src/middleware.ts`, the invite page should be accessible without authentication for viewing (the server component handles auth-gated acceptance). The current middleware only protects `/dashboard/*`, `/projects/*`, `/admin/*`, and `/api/admin/*` — so `/invite/*` is already public. No change needed.

**Step 4: Commit**

```bash
git add src/app/invite/[token]/page.tsx src/app/invite/[token]/invite-client.tsx
git commit -m "feat: add invite acceptance page"
```

---

### Task 13: Add invite management UI to settings page

**Files:**
- Modify: `src/components/settings/settings-client.tsx`

**Step 1: Add Invites tab to settings**

Add a fourth tab "Invites" to the settings page alongside General, Features, and Members. This tab allows org admins to:
- View pending invites
- Create new invites (email + role)
- Copy invite link
- Delete pending invites

In `settings-client.tsx`, add:

1. A new state for invites:
```typescript
const [invites, setInvites] = useState<Array<{
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}>>([]);
const [inviteEmail, setInviteEmail] = useState("");
const [inviteRole, setInviteRole] = useState("MEMBER");
const [inviteLoading, setInviteLoading] = useState(false);
```

2. Fetch invites when the Invites tab is selected (use the active org from session):
```typescript
async function fetchInvites() {
  const res = await fetch(`/api/organizations/${activeOrganizationId}/invites`);
  const data = await res.json();
  if (data.data) setInvites(data.data);
}
```

3. Create invite handler:
```typescript
async function handleCreateInvite() {
  setInviteLoading(true);
  try {
    const res = await fetch(`/api/organizations/${activeOrganizationId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message);
      return;
    }
    toast.success(`Invite sent to ${inviteEmail}`);
    setInviteEmail("");
    fetchInvites();
  } finally {
    setInviteLoading(false);
  }
}
```

4. Add the Invites tab UI with:
   - Input field for email
   - Role selector (Admin, Member)
   - "Send Invite" button
   - Table of pending invites with copy link + delete buttons

Note: You'll need to pass `activeOrganizationId` from the session. Add `activeOrganizationId` to the SettingsClient props or fetch from `useSession()`.

**Step 2: Commit**

```bash
git add src/components/settings/settings-client.tsx
git commit -m "feat: add invite management UI to project settings"
```

---

### Task 14: Create Dockerfile for production build

**Files:**
- Create: `Dockerfile`

**Step 1: Create multi-stage Dockerfile**

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Skip DB push during build — handled at runtime
RUN npx prisma generate && npx next build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Step 2: Update next.config.ts for standalone output**

Add `output: "standalone"` to next.config.ts:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  // ... rest of config
};
```

**Step 3: Add .dockerignore**

Create `.dockerignore`:

```
node_modules
.next
.git
.env
.env.local
*.md
docs/
.claude/
```

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "feat: add Dockerfile for production build"
```

---

### Task 15: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create docker-compose.yml**

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://planowiz:planowiz_secret@db:5432/planowiz
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-change-me-in-production}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
      BLOB_READ_WRITE_TOKEN: ${BLOB_READ_WRITE_TOKEN:-}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: planowiz
      POSTGRES_USER: planowiz
      POSTGRES_PASSWORD: planowiz_secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U planowiz -d planowiz"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for full-stack deployment"
```

---

### Task 16: Add health check API endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

**Step 1: Create health check endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const health: {
    status: "ok" | "degraded" | "error";
    timestamp: string;
    checks: Record<string, { status: string; latencyMs?: number; error?: string }>;
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check database connectivity
  try {
    const start = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    health.checks.database = {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    health.status = "error";
    health.checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
```

**Step 2: Add /api/health to middleware exceptions**

The current middleware only protects specific paths (`/dashboard/*`, `/projects/*`, `/admin/*`, `/api/admin/*`), so `/api/health` is already public. No change needed.

**Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add health check API endpoint"
```

---

### Task 17: Update .env.example with new variables

**Files:**
- Modify: `.env.example`

**Step 1: Add new environment variables**

Update `.env.example` to include:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_tracker"
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# App URL (used for invite links)
APP_URL="http://localhost:3000"
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: update .env.example with app URL"
```

---

### Task 18: Integration test — end-to-end verification

**Files:** None (verification only)

**Step 1: Run Prisma generate and push**

```bash
npx prisma generate && npx prisma db push
```
Expected: Schema pushed successfully, no errors

**Step 2: Run seed**

```bash
npx tsx prisma/seed.ts
```
Expected: Seed completes with "Created organization: Demo Organization"

**Step 3: Run build**

```bash
npx next build
```
Expected: Build succeeds with no TypeScript errors

**Step 4: Start dev server and verify**

```bash
npm run dev
```
Then manually verify:
1. Login works at `/login`
2. Dashboard loads at `/dashboard`
3. Projects list shows org-scoped projects
4. Health check responds at `/api/health`
5. Organization API returns data at `/api/organizations`

**Step 5: Run existing tests**

```bash
npm test
```
Expected: All existing tests pass

**Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for organization support"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Add Organization models to schema | `prisma/schema.prisma` |
| 2 | Data migration script | `prisma/migrations/add-organization.ts` |
| 3 | Update seed.ts | `prisma/seed.ts` |
| 4 | Extend NextAuth session | `src/types/next-auth.d.ts`, `src/lib/auth.ts` |
| 5 | Org-scoped API utils | `src/lib/api-utils.ts` |
| 6 | Scope project APIs by org | `src/app/api/projects/route.ts` |
| 7 | Org list API | `src/app/api/organizations/route.ts` |
| 8 | Org switcher in sidebar | `src/components/layout/app-sidebar.tsx` |
| 9 | Verify org in project layout | `src/app/(authenticated)/projects/[id]/layout.tsx` |
| 10 | Invite create/list API | `src/app/api/organizations/[orgId]/invites/route.ts` |
| 11 | Invite delete/accept API | `src/app/api/organizations/[orgId]/invites/[inviteId]/route.ts`, `src/app/api/invites/[token]/route.ts` |
| 12 | Invite acceptance page | `src/app/invite/[token]/page.tsx` |
| 13 | Invite UI in settings | `src/components/settings/settings-client.tsx` |
| 14 | Dockerfile | `Dockerfile`, `.dockerignore`, `next.config.ts` |
| 15 | docker-compose.yml | `docker-compose.yml` |
| 16 | Health check endpoint | `src/app/api/health/route.ts` |
| 17 | Update .env.example | `.env.example` |
| 18 | Integration verification | (verification only) |
