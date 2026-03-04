"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-background to-sky-50 dark:from-brand-950/30 dark:via-background dark:to-sky-950/20" />

      {/* Decorative blobs */}
      <div className="absolute -left-32 -top-32 -z-10 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-800/20" />
      <div className="absolute -bottom-32 -right-32 -z-10 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-800/20" />
      <div className="absolute left-1/2 top-1/4 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-200/30 blur-3xl dark:bg-fuchsia-800/15" />

      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="animate-dash-fade-up mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 shadow-lg shadow-brand-500/25">
            <FolderKanban className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            ProjectTracker
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your projects with clarity
          </p>
        </div>

        {/* Login Card */}
        <Card
          className="animate-dash-fade-up rounded-2xl border bg-card/80 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-card/60"
          style={{ animationDelay: "75ms" }}
        >
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl transition-colors focus-visible:border-brand-400 focus-visible:ring-brand-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl transition-colors focus-visible:border-brand-400 focus-visible:ring-brand-400/20"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg hover:shadow-brand-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials hint */}
        <div
          className="animate-dash-fade-up mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-center dark:border-brand-500/20 dark:bg-brand-500/5"
          style={{ animationDelay: "150ms" }}
        >
          <p className="text-xs font-medium text-brand-600/80 dark:text-brand-400/80">
            Demo credentials
          </p>
          <p className="mt-0.5 text-xs text-brand-500/70 dark:text-brand-400/60">
            admin@projecttracker.com / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
