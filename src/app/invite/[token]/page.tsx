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
