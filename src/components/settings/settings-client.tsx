"use client";

import { useState, useCallback } from "react";
import {
  Settings2,
  ToggleRight,
  Users,
  Save,
  UserPlus,
  Trash2,
  KanbanSquare,
  ListTodo,
  Timer,
  GanttChart,
  BarChart3,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FEATURE_DEPENDENCIES } from "@/lib/feature-utils";

/** Client-side alias — mirrors FEATURE_DEPENDENCIES from the server. */
const FEATURE_DEPS = FEATURE_DEPENDENCIES;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface Project {
  id: string;
  name: string;
  description: string | null;
  key: string;
  ownerId: string;
}

interface Feature {
  id: string;
  featureKey: string;
  enabled: boolean;
  description: string | null;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}

interface SettingsClientProps {
  project: Project;
  features: Feature[];
  members: Member[];
  isAdminOrManager: boolean;
  currentUserId: string;
}

/* -------------------------------------------------------------------------- */
/*  Feature definitions (display metadata)                                    */
/* -------------------------------------------------------------------------- */

const FEATURE_DEFINITIONS: Record<
  string,
  { label: string; description: string; icon: React.ElementType }
> = {
  kanban: {
    label: "Kanban Board",
    description: "Drag-and-drop task board",
    icon: KanbanSquare,
  },
  backlog: {
    label: "Backlog",
    description: "Backlog management view",
    icon: ListTodo,
  },
  sprints: {
    label: "Sprint Planning",
    description: "Sprint planning and management",
    icon: Timer,
  },
  timeline: {
    label: "Gantt Timeline",
    description: "Gantt chart timeline view",
    icon: GanttChart,
  },
  reports: {
    label: "Reports",
    description: "Reporting dashboards",
    icon: BarChart3,
  },
  excel: {
    label: "Excel Visualization",
    description: "Excel data upload and visualization",
    icon: FileSpreadsheet,
  },
};

const FEATURE_KEYS = Object.keys(FEATURE_DEFINITIONS);

/* -------------------------------------------------------------------------- */
/*  Role badge helpers                                                        */
/* -------------------------------------------------------------------------- */

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case "ADMIN":
      return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800";
    case "MANAGER":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function SettingsClient({
  project,
  features,
  members: initialMembers,
  isAdminOrManager,
  currentUserId,
}: SettingsClientProps) {
  // -- General tab state --
  const [projectName, setProjectName] = useState(project.name);
  const [projectDescription, setProjectDescription] = useState(
    project.description ?? ""
  );
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string | null>(null);

  // -- Features tab state --
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      for (const key of FEATURE_KEYS) {
        const found = features.find((f) => f.featureKey === key);
        map[key] = found?.enabled ?? false;
      }
      return map;
    }
  );
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [featuresMessage, setFeaturesMessage] = useState<string | null>(null);

  // -- Members tab state --
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("MEMBER");
  const [addingMember, setAddingMember] = useState(false);
  const [membersMessage, setMembersMessage] = useState<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /*  General tab handlers                                                   */
  /* ---------------------------------------------------------------------- */

  const handleSaveGeneral = useCallback(async () => {
    setGeneralSaving(true);
    setGeneralMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGeneralMessage(json.message ?? "Failed to save.");
      } else {
        setGeneralMessage("Project updated successfully.");
      }
    } catch {
      setGeneralMessage("Network error. Please try again.");
    } finally {
      setGeneralSaving(false);
    }
  }, [project.id, projectName, projectDescription]);

  /* ---------------------------------------------------------------------- */
  /*  Features tab handlers                                                  */
  /* ---------------------------------------------------------------------- */

  const handleToggleFeature = useCallback(
    (key: string, enabled: boolean) => {
      setFeatureStates((prev) => {
        const next = { ...prev, [key]: enabled };
        // Enforce dependencies: if disabling a feature, also disable dependents
        if (!enabled) {
          for (const [dependent, dependency] of Object.entries(FEATURE_DEPS)) {
            if (dependency === key) {
              next[dependent] = false;
            }
          }
        }
        return next;
      });
    },
    []
  );

  const handleSaveFeatures = useCallback(async () => {
    setFeaturesSaving(true);
    setFeaturesMessage(null);
    try {
      const payload = FEATURE_KEYS.map((key) => ({
        featureKey: key,
        enabled: featureStates[key] ?? false,
      }));
      const res = await fetch(`/api/projects/${project.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeaturesMessage(json.message ?? "Failed to save features.");
      } else {
        setFeaturesMessage("Feature toggles updated successfully.");
      }
    } catch {
      setFeaturesMessage("Network error. Please try again.");
    } finally {
      setFeaturesSaving(false);
    }
  }, [project.id, featureStates]);

  /* ---------------------------------------------------------------------- */
  /*  Members tab handlers                                                   */
  /* ---------------------------------------------------------------------- */

  const handleAddMember = useCallback(async () => {
    setAddingMember(true);
    setMembersMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newMemberEmail,
          role: newMemberRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMembersMessage(json.message ?? "Failed to add member.");
      } else {
        setMembers((prev) => [...prev, json.data]);
        setNewMemberEmail("");
        setNewMemberRole("MEMBER");
        setAddDialogOpen(false);
        setMembersMessage("Member added successfully.");
      }
    } catch {
      setMembersMessage("Network error. Please try again.");
    } finally {
      setAddingMember(false);
    }
  }, [project.id, newMemberEmail, newMemberRole]);

  const handleUpdateRole = useCallback(
    async (memberId: string, newRole: string) => {
      setMembersMessage(null);
      try {
        const res = await fetch(
          `/api/projects/${project.id}/members/${memberId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: newRole }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          setMembersMessage(json.message ?? "Failed to update role.");
        } else {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId ? { ...m, role: newRole } : m
            )
          );
        }
      } catch {
        setMembersMessage("Network error. Please try again.");
      }
    },
    [project.id]
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      setMembersMessage(null);
      try {
        const res = await fetch(
          `/api/projects/${project.id}/members/${memberId}`,
          { method: "DELETE" }
        );
        const json = await res.json();
        if (!res.ok) {
          setMembersMessage(json.message ?? "Failed to remove member.");
        } else {
          setMembers((prev) => prev.filter((m) => m.id !== memberId));
          setMembersMessage("Member removed successfully.");
        }
      } catch {
        setMembersMessage("Network error. Please try again.");
      }
    },
    [project.id]
  );

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="general" className="gap-2">
            <Settings2 className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <ToggleRight className="size-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="size-4" />
            Members
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/*  General Tab                                                      */}
        {/* ================================================================ */}
        <TabsContent value="general">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-1 text-base font-semibold">Project Details</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Update your project name and description.
            </p>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="project-key">Project Key</Label>
                <Input
                  id="project-key"
                  value={project.key}
                  disabled
                  className="max-w-xs bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  Project key cannot be changed after creation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  disabled={!isAdminOrManager}
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Enter project description"
                  disabled={!isAdminOrManager}
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                />
              </div>

              {generalMessage && (
                <p
                  className={`text-sm ${
                    generalMessage.includes("success")
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {generalMessage}
                </p>
              )}

              {isAdminOrManager && (
                <Button
                  onClick={handleSaveGeneral}
                  disabled={generalSaving || !projectName.trim()}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {generalSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/*  Features Tab                                                     */}
        {/* ================================================================ */}
        <TabsContent value="features">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-1 text-base font-semibold">Feature Toggles</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Enable or disable features for this project.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURE_KEYS.map((key) => {
                const def = FEATURE_DEFINITIONS[key];
                const enabled = featureStates[key] ?? false;
                const Icon = def.icon;

                // Check if this feature's dependency is disabled
                const depKey = FEATURE_DEPS[key];
                const depDisabled = depKey ? !(featureStates[depKey] ?? false) : false;
                const depLabel = depKey ? FEATURE_DEFINITIONS[depKey]?.label : null;

                return (
                  <div
                    key={key}
                    className={`relative flex items-start gap-4 rounded-xl border p-4 transition-all ${
                      enabled && !depDisabled
                        ? "border-violet-300 bg-violet-50/50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30"
                        : "border-border bg-card hover:border-muted-foreground/20"
                    }`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        enabled && !depDisabled
                          ? "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">{def.label}</h3>
                        <Switch
                          checked={enabled && !depDisabled}
                          onCheckedChange={(checked) =>
                            handleToggleFeature(key, checked)
                          }
                          disabled={!isAdminOrManager || depDisabled}
                          className="data-[state=checked]:bg-violet-600"
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {def.description}
                      </p>
                      {depDisabled && depLabel && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          Requires {depLabel} to be enabled
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {featuresMessage && (
              <p
                className={`mt-4 text-sm ${
                  featuresMessage.includes("success")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {featuresMessage}
              </p>
            )}

            {isAdminOrManager && (
              <Button
                onClick={handleSaveFeatures}
                disabled={featuresSaving}
                className="mt-6 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {featuresSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save Features
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/*  Members Tab                                                      */}
        {/* ================================================================ */}
        <TabsContent value="members">
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Team Members</h2>
                <p className="text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? "s" : ""} in
                  this project
                </p>
              </div>

              {isAdminOrManager && (
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                      <UserPlus className="size-4" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>
                        Invite a user to this project by entering their email
                        address.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="member-email">Email Address</Label>
                        <Input
                          id="member-email"
                          type="email"
                          placeholder="user@example.com"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="member-role">Role</Label>
                        <Select
                          value={newMemberRole}
                          onValueChange={setNewMemberRole}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddMember}
                        disabled={addingMember || !newMemberEmail.trim()}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        {addingMember ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserPlus className="size-4" />
                        )}
                        Add Member
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {membersMessage && (
              <p
                className={`mb-4 text-sm ${
                  membersMessage.includes("success")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {membersMessage}
              </p>
            )}

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {isAdminOrManager && (
                      <TableHead className="w-[80px] text-right">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isOwner = member.userId === project.ownerId;
                    const isSelf = member.userId === currentUserId;

                    return (
                      <TableRow key={member.id} className="h-16">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar size="default">
                              {member.user.avatar && (
                                <AvatarImage
                                  src={member.user.avatar}
                                  alt={member.user.name}
                                />
                              )}
                              <AvatarFallback className="bg-violet-100 text-violet-700 text-xs dark:bg-violet-900 dark:text-violet-300">
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {member.user.name}
                                </span>
                                {isOwner && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                                  >
                                    Owner
                                  </Badge>
                                )}
                                {isSelf && (
                                  <span className="text-[10px] text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.user.email}
                        </TableCell>
                        <TableCell>
                          {isAdminOrManager && !isOwner ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                handleUpdateRole(member.id, value)
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MEMBER">Member</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className={getRoleBadgeClasses(member.role)}
                            >
                              {member.role}
                            </Badge>
                          )}
                        </TableCell>
                        {isAdminOrManager && (
                          <TableCell className="text-right">
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={isAdminOrManager ? 4 : 3}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No members found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
