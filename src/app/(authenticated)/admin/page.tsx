import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminClient } from "@/components/admin/admin-client";
import { ShieldCheck } from "lucide-react";

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
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-dash-fade-up flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <ShieldCheck className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {serializedUsers.length} user{serializedUsers.length !== 1 ? "s" : ""} registered
          </p>
        </div>
      </div>

      {/* Admin content */}
      <div
        className="animate-dash-fade-up"
        style={{ animationDelay: "75ms" }}
      >
        <AdminClient
          users={serializedUsers}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
