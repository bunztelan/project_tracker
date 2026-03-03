"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  FolderKanban,
  LayoutDashboard,
  FolderOpen,
  Kanban,
  ListTodo,
  Zap,
  GanttChart,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
  ChevronsUpDown,
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
  SidebarSeparator,
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

const projectNavItems = [
  { title: "Board", segment: "board", icon: Kanban, featureKey: "board" },
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
    title: "Data",
    segment: "data",
    icon: FileSpreadsheet,
    featureKey: "data",
  },
  {
    title: "Settings",
    segment: "settings",
    icon: Settings,
    featureKey: "settings",
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  featureToggles?: FeatureToggleMap;
}

export function AppSidebar({ featureToggles, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state } = useSidebar();

  const isCollapsed = state === "collapsed";

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
    if (!featureToggles) return true; // Show all if no toggles provided
    return featureToggles[item.featureKey] !== false; // Show unless explicitly disabled
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* App Header / Brand */}
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3 group/brand">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25 transition-shadow group-hover/brand:shadow-lg group-hover/brand:shadow-violet-500/35">
            <FolderKanban className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground">
                ProjectTracker
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                Manage with clarity
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
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
                          ? "bg-gradient-to-r from-violet-500/15 to-indigo-500/10 text-violet-700 font-semibold hover:from-violet-500/20 hover:to-indigo-500/15 dark:from-violet-500/25 dark:to-indigo-500/20 dark:text-violet-300"
                          : "text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                      }
                    >
                      <Link href={item.href}>
                        <item.icon
                          className={
                            isActive
                              ? "text-violet-600 dark:text-violet-400"
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

        {/* Project Sub-Navigation — only visible when viewing a project */}
        {projectId && visibleProjectNavItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Project
              </SidebarGroupLabel>
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
                              ? "bg-gradient-to-r from-violet-500/15 to-indigo-500/10 text-violet-700 font-semibold hover:from-violet-500/20 hover:to-indigo-500/15 dark:from-violet-500/25 dark:to-indigo-500/20 dark:text-violet-300"
                              : "text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                          }
                        >
                          <Link href={href}>
                            <item.icon
                              className={
                                isActive
                                  ? "text-violet-600 dark:text-violet-400"
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
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={userName}
                  className="hover:bg-violet-50 dark:hover:bg-violet-500/10 data-[state=open]:bg-violet-50 dark:data-[state=open]:bg-violet-500/10"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        className="mt-0.5 h-4 px-1.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
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
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold text-white">
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
