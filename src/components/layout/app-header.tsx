"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/** Map known route segments to friendly labels */
const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  board: "Board",
  backlog: "Backlog",
  sprints: "Sprints",
  timeline: "Timeline",
  reports: "Reports",
  data: "Data",
  settings: "Settings",
  admin: "Admin",
};

function useBreadcrumbs() {
  const pathname = usePathname();

  // Split pathname into segments, filter empties
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { label: string; href: string; isLast: boolean }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Try to get a friendly label; fallback to the segment itself (decapitalized IDs)
    const label =
      segmentLabels[segment] ??
      (segment.length > 20 ? segment.slice(0, 8) + "..." : segment);

    crumbs.push({
      label,
      href: currentPath,
      isLast: i === segments.length - 1,
    });
  }

  return crumbs;
}

export function AppHeader() {
  const { data: session } = useSession();
  const crumbs = useBreadcrumbs();

  const userName = session?.user?.name ?? "User";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-sm">
      {/* Sidebar Toggle */}
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />

      <Separator orientation="vertical" className="mr-1 h-5" />

      {/* Breadcrumb */}
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {crumbs.flatMap((crumb, idx) => [
            ...(idx > 0 ? [<BreadcrumbSeparator key={`sep-${crumb.href}`} />] : []),
            <BreadcrumbItem key={crumb.href}>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
          ])}
        </BreadcrumbList>
      </Breadcrumb>

      {/* User Avatar + Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-lg">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold text-white">
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
    </header>
  );
}
