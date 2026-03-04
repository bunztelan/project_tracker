import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
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
      plan: "PRO",
    },
  });
  console.log(`  Created organization: ${org.name} (${org.id})`);

  // 3. Link all existing projects to this organization
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
    const orgRole =
      user.role === "ADMIN"
        ? "OWNER"
        : user.role === "MANAGER"
          ? "ADMIN"
          : "MEMBER";

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
