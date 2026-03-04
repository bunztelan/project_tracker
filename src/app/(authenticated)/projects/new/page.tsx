"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, FolderPlus } from "lucide-react";
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
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/*  Helper — generate project key from name                                   */
/* -------------------------------------------------------------------------- */

function generateKey(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  New Project Page                                                          */
/* -------------------------------------------------------------------------- */

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-generate key from name unless manually edited
  useEffect(() => {
    if (!isKeyManuallyEdited && name.trim()) {
      setKey(generateKey(name));
    } else if (!isKeyManuallyEdited && !name.trim()) {
      setKey("");
    }
  }, [name, isKeyManuallyEdited]);

  function handleKeyChange(value: string) {
    setIsKeyManuallyEdited(true);
    setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }

    if (key.length < 2) {
      toast.error("Project key must be at least 2 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key,
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || "Failed to create project.");
        return;
      }

      toast.success("Project created successfully!");
      router.push(`/projects/${result.data.id}/board`);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/projects"
        className="animate-dash-fade-up inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      {/* Page Header */}
      <div
        className="animate-dash-fade-up flex items-center gap-4"
        style={{ animationDelay: "50ms" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <FolderPlus className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create New Project
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up a new project with boards, features, and dashboards.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card
        className="animate-dash-fade-up rounded-2xl border shadow-sm"
        style={{ animationDelay: "100ms" }}
      >
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Fill in the basic information for your new project.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Mobile App Redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Project Key */}
            <div className="space-y-2">
              <Label htmlFor="key">
                Project Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key"
                type="text"
                placeholder="e.g. MAR"
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                required
                minLength={2}
                maxLength={10}
                className="h-11 rounded-xl font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                A short, unique identifier for the project (2-10 characters).
                Auto-generated from the project name.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                placeholder="Briefly describe the project goals and scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            {/* Preview */}
            {name.trim() && key.length >= 2 && (
              <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Preview
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-semibold text-foreground">
                    {name.trim()}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {key}
                  </span>
                </div>
                {description.trim() && (
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {description.trim()}
                  </p>
                )}
              </div>
            )}

            {/* What gets created info */}
            <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">
                This will automatically create:
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>A default Kanban board with To Do, In Progress, In Review, and Done columns</li>
                <li>Project dashboard for analytics</li>
                <li>Feature toggles for Kanban, Backlog, Reports, and Excel tools</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 text-white shadow-md shadow-brand-500/25 transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg hover:shadow-brand-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4" />
                    Create Project
                  </>
                )}
              </Button>
              <Link href="/projects">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-xl"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
