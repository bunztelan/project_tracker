"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  createdAt: string;
}

interface AdminClientProps {
  users: User[];
  currentUserId: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case "ADMIN":
      return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30";
    case "MANAGER":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30";
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function AdminClient({ users: initialUsers, currentUserId }: AdminClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Create user form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("MEMBER");

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  /* ---------------------------------------------------------------------- */
  /*  Create User                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleCreateUser() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.message || "Failed to create user.");
        return;
      }

      setUsers((prev) => [json.data, ...prev]);
      setIsCreateOpen(false);
      resetCreateForm();
      router.refresh();
    } catch {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetCreateForm() {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("MEMBER");
    setErrorMessage("");
  }

  /* ---------------------------------------------------------------------- */
  /*  Change Role                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Delete User                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.message || "Failed to delete user.");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Create user button */}
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/35 hover:from-brand-700 hover:to-brand-600">
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. They will be able to sign in with
                the credentials you provide.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {errorMessage && (
                <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={
                  isLoading || !newName.trim() || !newEmail.trim() || !newPassword.trim()
                }
                className="bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600"
              >
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-12 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                User
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Role
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Joined
              </TableHead>
              <TableHead className="h-12 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  {searchQuery
                    ? "No users match your search."
                    : "No users found."}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                return (
                  <TableRow
                    key={user.id}
                    className="group h-16 transition-colors hover:bg-brand-50/50 dark:hover:bg-brand-500/5"
                  >
                    {/* Avatar + Name */}
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {user.avatar && (
                            <AvatarImage src={user.avatar} alt={user.name} />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-brand-600 to-brand-500 text-xs font-semibold text-white">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {user.name}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] font-medium text-brand-600 dark:text-brand-400">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${getRoleBadgeClasses(user.role)}`}
                      >
                        {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>

                    {/* Created date */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {/* Role dropdown */}
                        <Select
                          value={user.role}
                          onValueChange={(value) =>
                            handleRoleChange(user.id, value)
                          }
                          disabled={isCurrentUser}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <UserCog className="mr-1 h-3 w-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentUser}
                          onClick={() => {
                            setDeleteTarget(user);
                            setIsDeleteOpen(true);
                            setErrorMessage("");
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setErrorMessage("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone. The user will lose access to all
              projects.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
