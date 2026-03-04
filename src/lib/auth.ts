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
