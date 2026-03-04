"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { featureStore } from "@/lib/feature-store";
import {
  LayoutDashboard,
  FolderOpen,
  Kanban,
  ListTodo,
  Zap,
  GanttChart,
  BarChart3,
  Settings,
  LogOut,
  ChevronsUpDown,
  ShieldCheck,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useProjectOptional } from "@/contexts/project-context";

/** Feature toggle keys for project sub-nav items */
export type FeatureToggleMap = Record<string, boolean>;

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderOpen,
  },
];

const adminNavItem = {
  title: "Admin",
  href: "/admin",
  icon: ShieldCheck,
};

const projectNavItems = [
  { title: "Board", segment: "board", icon: Kanban, featureKey: "kanban" },
  {
    title: "Backlog",
    segment: "backlog",
    icon: ListTodo,
    featureKey: "backlog",
  },
  { title: "Sprints", segment: "sprints", icon: Zap, featureKey: "sprints" },
  {
    title: "Timeline",
    segment: "timeline",
    icon: GanttChart,
    featureKey: "timeline",
  },
  {
    title: "Reports",
    segment: "reports",
    icon: BarChart3,
    featureKey: "reports",
  },
  {
    title: "Settings",
    segment: "settings",
    icon: Settings,
    featureKey: null,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  featureToggles?: FeatureToggleMap;
}

export function AppSidebar({ featureToggles: featureTogglesProp, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state } = useSidebar();
  const projectCtx = useProjectOptional();

  const isCollapsed = state === "collapsed";

  // Fetch user's organizations
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string; slug: string; plan: string; role: string }>
  >([]);

  useEffect(() => {
    fetch("/api/organizations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) setOrganizations(data.data);
      })
      .catch(() => {});
  }, []);

  // Subscribe to the global feature store (synced from ProjectProvider via SyncFeatures)
  const [storeFeatures, setStoreFeatures] = useState<Record<string, boolean> | null>(
    () => featureStore.get()
  );
  useEffect(() => {
    return featureStore.subscribe(() => setStoreFeatures(featureStore.get()));
  }, []);

  // Prefer feature toggles from ProjectContext, then store, then prop, then undefined
  const featureToggles = projectCtx?.features ?? storeFeatures ?? featureTogglesProp;

  // Detect if we're viewing a specific project: /projects/[projectId]/...
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];

  const userName = session?.user?.name ?? "User";
  const userRole = session?.user?.role ?? "MEMBER";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Format role for display
  const roleLabel =
    userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase();

  // Filter project nav items based on feature toggles
  const visibleProjectNavItems = projectNavItems.filter((item) => {
    if (!item.featureKey) return true; // Always show items without a feature key (e.g. Settings)
    if (!featureToggles) return true; // Show all if no toggles provided
    return featureToggles[item.featureKey] !== false; // Show unless explicitly disabled
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* App Header / Brand */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-3 group/brand">
          <Image
            src="/logo.png"
            alt="Planowiz"
            width={32}
            height={32}
            className="shrink-0"
          />
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold tracking-tight text-foreground">
                Planowiz
              </span>
              {organizations.length > 0 ? (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0 text-brand-500" />
                  <span className="truncate text-[11px] font-medium text-brand-600 dark:text-brand-400">
                    {organizations.find(o => o.id === session?.user?.activeOrganizationId)?.name ?? organizations[0]?.name}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  Manage with clarity
                </span>
              )}
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={
                        isActive
                          ? "bg-gradient-to-r from-brand-500/15 to-brand-500/10 text-brand-700 font-semibold hover:from-brand-500/20 hover:to-brand-500/15 dark:from-brand-500/25 dark:to-brand-500/20 dark:text-brand-300"
                          : "text-muted-foreground hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      }
                    >
                      <Link href={item.href}>
                        <item.icon
                          className={
                            isActive
                              ? "text-brand-600 dark:text-brand-400"
                              : ""
                          }
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {/* Admin link — only visible to ADMIN users */}
              {userRole === "ADMIN" && (() => {
                const isActive = pathname.startsWith(adminNavItem.href);
                return (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={adminNavItem.title}
                      className={
                        isActive
                          ? "bg-gradient-to-r from-brand-500/15 to-brand-500/10 text-brand-700 font-semibold hover:from-brand-500/20 hover:to-brand-500/15 dark:from-brand-500/25 dark:to-brand-500/20 dark:text-brand-300"
                          : "text-muted-foreground hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      }
                    >
                      <Link href={adminNavItem.href}>
                        <adminNavItem.icon
                          className={
                            isActive
                              ? "text-brand-600 dark:text-brand-400"
                              : ""
                          }
                        />
                        <span>{adminNavItem.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Project Sub-Navigation — only visible when viewing a project */}
        {projectId && visibleProjectNavItems.length > 0 && (
          <>
            <div className="mx-4 border-t border-sidebar-border" />
            <SidebarGroup>
              {/* Project indicator */}
              {!isCollapsed && projectCtx?.project && (
                <Link
                  href={`/projects/${projectId}/board`}
                  className="mx-2 mb-1 flex items-center gap-2.5 rounded-lg bg-brand-50 px-3 py-2 transition-colors hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/15"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-600 to-brand-500 text-[11px] font-bold text-white shadow-sm">
                    {projectCtx.project.key.slice(0, 2)}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {projectCtx.project.name}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {projectCtx.project.key}
                    </span>
                  </div>
                </Link>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleProjectNavItems.map((item) => {
                    const href = `/projects/${projectId}/${item.segment}`;
                    const isActive = pathname.startsWith(href);
                    return (
                      <SidebarMenuItem key={item.segment}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className={
                            isActive
                              ? "bg-gradient-to-r from-brand-500/15 to-brand-500/10 text-brand-700 font-semibold hover:from-brand-500/20 hover:to-brand-500/15 dark:from-brand-500/25 dark:to-brand-500/20 dark:text-brand-300"
                              : "text-muted-foreground hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                          }
                        >
                          <Link href={href}>
                            <item.icon
                              className={
                                isActive
                                  ? "text-brand-600 dark:text-brand-400"
                                  : ""
                              }
                            />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* User Menu at Bottom */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={userName}
                  className="hover:bg-brand-50 dark:hover:bg-brand-500/10 data-[state=open]:bg-brand-50 dark:data-[state=open]:bg-brand-500/10"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-xs font-semibold text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        className="mt-0.5 h-4 px-1.5 text-[10px] font-medium bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                      >
                        {roleLabel}
                      </Badge>
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="start"
                sideOffset={8}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-9 w-9 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-xs font-semibold text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user?.email}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
