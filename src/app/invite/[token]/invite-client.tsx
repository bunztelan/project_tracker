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
                    This invite was sent to <strong>{email}</strong>, but you&apos;re logged in as <strong>{loggedInEmail}</strong>.
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
