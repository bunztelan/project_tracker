import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminClient } from "@/components/admin/admin-client";

/* -------------------------------------------------------------------------- */
/*  Admin page — server component (Admin only)                                */
/* -------------------------------------------------------------------------- */

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      createdAt: true,
    },
  });

  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {serializedUsers.length} user{serializedUsers.length !== 1 ? "s" : ""} registered
          </p>
        </div>
      </div>

      {/* Admin content */}
      <div className="flex-1 overflow-y-auto">
        <AdminClient
          users={serializedUsers}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
