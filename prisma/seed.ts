import "dotenv/config";
import { PrismaClient, Role, TaskPriority, TaskType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── 1. Demo Users ────────────────────────────────────────────────
  const adminPassword = await hash("admin123", 12);
  const managerPassword = await hash("manager123", 12);
  const memberPassword = await hash("member123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@projecttracker.com" },
    update: {},
    create: {
      email: "admin@projecttracker.com",
      name: "Admin User",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@projecttracker.com" },
    update: {},
    create: {
      email: "manager@projecttracker.com",
      name: "Manager User",
      password: managerPassword,
      role: Role.MANAGER,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@projecttracker.com" },
    update: {},
    create: {
      email: "member@projecttracker.com",
      name: "Member User",
      password: memberPassword,
      role: Role.MEMBER,
    },
  });

  console.log("  Created users:", admin.email, manager.email, member.email);

  // ── 2. Demo Project ──────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { key: "DEMO" },
    update: {},
    create: {
      name: "Demo Project",
      description: "A demo project to explore ProjectTracker features",
      key: "DEMO",
      ownerId: admin.id,
    },
  });

  console.log("  Created project:", project.name);

  // ── 3. Project Members ───────────────────────────────────────────
  const members = [
    { userId: admin.id, role: Role.ADMIN },
    { userId: manager.id, role: Role.MANAGER },
    { userId: member.id, role: Role.MEMBER },
  ];

  for (const m of members) {
    await prisma.projectMember.upsert({
      where: {
        userId_projectId: { userId: m.userId, projectId: project.id },
      },
      update: {},
      create: {
        userId: m.userId,
        projectId: project.id,
        role: m.role,
      },
    });
  }

  console.log("  Added project members");

  // ── 4. Feature Toggles ───────────────────────────────────────────
  const featureToggles = [
    { featureKey: "kanban_board", enabled: true, description: "Kanban board view" },
    { featureKey: "backlog", enabled: true, description: "Product backlog" },
    { featureKey: "sprint_planning", enabled: false, description: "Sprint planning and management" },
    { featureKey: "gantt_timeline", enabled: false, description: "Gantt chart timeline view" },
    { featureKey: "reports", enabled: true, description: "Project reports and analytics" },
    { featureKey: "excel_visualization", enabled: true, description: "Excel file upload and visualization" },
  ];

  for (const ft of featureToggles) {
    await prisma.featureToggle.upsert({
      where: {
        featureKey_projectId: {
          featureKey: ft.featureKey,
          projectId: project.id,
        },
      },
      update: {},
      create: {
        featureKey: ft.featureKey,
        enabled: ft.enabled,
        description: ft.description,
        projectId: project.id,
      },
    });
  }

  console.log("  Created feature toggles");

  // ── 5. Default Board with 4 Columns ──────────────────────────────
  // For board, we use findFirst + create since there is no unique constraint
  // suitable for upsert beyond the id.
  let board = await prisma.board.findFirst({
    where: { projectId: project.id, name: "Main Board" },
  });

  if (!board) {
    board = await prisma.board.create({
      data: {
        name: "Main Board",
        projectId: project.id,
      },
    });
  }

  const columnDefs = [
    { name: "To Do", position: 0, statusKey: "todo" },
    { name: "In Progress", position: 1, statusKey: "in_progress" },
    { name: "In Review", position: 2, statusKey: "in_review" },
    { name: "Done", position: 3, statusKey: "done" },
  ];

  const columns: Record<string, { id: string; name: string; position: number; boardId: string }> = {};

  for (const col of columnDefs) {
    let column = await prisma.column.findFirst({
      where: { boardId: board.id, name: col.name },
    });

    if (!column) {
      column = await prisma.column.create({
        data: {
          name: col.name,
          position: col.position,
          statusKey: col.statusKey,
          boardId: board.id,
        },
      });
    }

    columns[col.name] = column;
  }

  console.log("  Created board with columns:", Object.keys(columns).join(", "));

  // ── 6. Sample Tasks ──────────────────────────────────────────────
  const taskDefs = [
    {
      title: "Set up project repository",
      description: "Initialize the git repository and configure CI/CD pipeline",
      status: "done",
      priority: TaskPriority.HIGH,
      type: TaskType.TASK,
      storyPoints: 3,
      position: 0,
      columnName: "Done",
      assigneeId: admin.id,
      reporterId: admin.id,
    },
    {
      title: "Design database schema",
      description: "Create the entity relationship diagram and define all database tables",
      status: "done",
      priority: TaskPriority.CRITICAL,
      type: TaskType.STORY,
      storyPoints: 8,
      position: 1,
      columnName: "Done",
      assigneeId: manager.id,
      reporterId: admin.id,
    },
    {
      title: "Implement user authentication",
      description: "Build login, registration, and session management with NextAuth.js",
      status: "in_review",
      priority: TaskPriority.HIGH,
      type: TaskType.STORY,
      storyPoints: 5,
      position: 0,
      columnName: "In Review",
      assigneeId: member.id,
      reporterId: manager.id,
    },
    {
      title: "Build dashboard widgets",
      description: "Create reusable chart and KPI widgets for the project dashboard",
      status: "in_progress",
      priority: TaskPriority.MEDIUM,
      type: TaskType.TASK,
      storyPoints: 5,
      position: 0,
      columnName: "In Progress",
      assigneeId: manager.id,
      reporterId: admin.id,
    },
    {
      title: "Fix sidebar navigation collapse",
      description: "The sidebar does not collapse properly on mobile viewports",
      status: "todo",
      priority: TaskPriority.LOW,
      type: TaskType.BUG,
      storyPoints: 2,
      position: 0,
      columnName: "To Do",
      assigneeId: member.id,
      reporterId: manager.id,
    },
    {
      title: "Add Excel export functionality",
      description: "Allow users to export project data and reports as Excel spreadsheets",
      status: "todo",
      priority: TaskPriority.MEDIUM,
      type: TaskType.STORY,
      storyPoints: 5,
      position: 1,
      columnName: "To Do",
      assigneeId: null,
      reporterId: admin.id,
    },
  ];

  for (const t of taskDefs) {
    const column = columns[t.columnName];

    // Use findFirst + create for idempotency (keyed on title + project)
    const existing = await prisma.task.findFirst({
      where: { title: t.title, projectId: project.id },
    });

    if (!existing) {
      await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          type: t.type,
          storyPoints: t.storyPoints,
          position: t.position,
          projectId: project.id,
          columnId: column.id,
          assigneeId: t.assigneeId,
          reporterId: t.reporterId,
        },
      });
    }
  }

  console.log("  Created sample tasks");

  // ── 7. Default Dashboard ─────────────────────────────────────────
  let dashboard = await prisma.dashboard.findFirst({
    where: { projectId: project.id, name: "Project Dashboard" },
  });

  if (!dashboard) {
    dashboard = await prisma.dashboard.create({
      data: {
        name: "Project Dashboard",
        projectId: project.id,
      },
    });
  }

  console.log("  Created dashboard:", dashboard.name);

  console.log("\nSeeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
