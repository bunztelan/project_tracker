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
