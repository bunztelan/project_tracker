"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BurndownChart,
  type BurndownDataPoint,
} from "@/components/reports/burndown-chart";
import {
  VelocityChart,
  type VelocityDataPoint,
} from "@/components/reports/velocity-chart";
import {
  TaskDistribution,
  type DistributionData,
} from "@/components/reports/task-distribution";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SprintInfo = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

interface ReportsClientProps {
  sprints: SprintInfo[];
  burndownBySprint: Record<
    string,
    { data: BurndownDataPoint[]; totalPoints: number }
  >;
  velocityData: VelocityDataPoint[];
  distributionData: DistributionData;
  defaultSprintId: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                              */
/* -------------------------------------------------------------------------- */

function SprintStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    PLANNING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    ACTIVE:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
    COMPLETED:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400",
  };

  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config[status] ?? ""}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  ReportsClient                                                             */
/* -------------------------------------------------------------------------- */

export function ReportsClient({
  sprints,
  burndownBySprint,
  velocityData,
  distributionData,
  defaultSprintId,
}: ReportsClientProps) {
  const [selectedSprintId, setSelectedSprintId] = useState<string>(
    defaultSprintId ?? ""
  );

  const selectedBurndown = selectedSprintId
    ? burndownBySprint[selectedSprintId]
    : null;

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  return (
    <Tabs defaultValue="sprint" className="space-y-6">
      <TabsList>
        <TabsTrigger value="sprint">Sprint Report</TabsTrigger>
        <TabsTrigger value="velocity">Velocity</TabsTrigger>
        <TabsTrigger value="distribution">Distribution</TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------------ */}
      {/*  Sprint Report Tab                                                  */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="sprint" className="space-y-6">
        {/* Sprint selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Sprint:
          </label>
          {sprints.length > 0 ? (
            <Select
              value={selectedSprintId}
              onValueChange={setSelectedSprintId}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a sprint" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    <span className="flex items-center">
                      {sprint.name}
                      <SprintStatusBadge status={sprint.status} />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">No sprints created yet</p>
          )}
        </div>

        {/* Burndown card */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Burndown Chart</CardTitle>
            <CardDescription>
              {selectedSprint
                ? `Tracking remaining work for ${selectedSprint.name}`
                : "Select a sprint to view its burndown chart"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedBurndown ? (
              <BurndownChart
                data={selectedBurndown.data}
                totalPoints={selectedBurndown.totalPoints}
              />
            ) : (
              <div className="flex h-80 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20">
                    <svg
                      className="h-6 w-6 text-brand-600 dark:text-brand-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No sprint selected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Choose a sprint from the dropdown above
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/*  Velocity Tab                                                       */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="velocity" className="space-y-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Team Velocity</CardTitle>
            <CardDescription>
              Story points completed vs committed across sprints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VelocityChart data={velocityData} />
          </CardContent>
        </Card>

        {/* Summary stats */}
        {velocityData.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Average Velocity</p>
                <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
                  {Math.round(
                    (velocityData.reduce((s, d) => s + d.completed, 0) /
                      velocityData.length) *
                      10
                  ) / 10}
                </p>
                <p className="text-xs text-muted-foreground">pts per sprint</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Best Sprint</p>
                <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.max(...velocityData.map((d) => d.completed))}
                </p>
                <p className="text-xs text-muted-foreground">pts completed</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Completed</p>
                <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
                  {velocityData.reduce((s, d) => s + d.completed, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  across {velocityData.length} sprint
                  {velocityData.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/*  Distribution Tab                                                   */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="distribution" className="space-y-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Task Distribution</CardTitle>
            <CardDescription>
              Breakdown of all project tasks by status, priority, and type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaskDistribution data={distributionData} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
