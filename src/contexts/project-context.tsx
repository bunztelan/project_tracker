"use client";

import { createContext, useContext } from "react";

type ProjectContextType = {
  project: {
    id: string;
    name: string;
    key: string;
    description: string | null;
  };
  features: Record<string, boolean>;
};

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ProjectContextType;
}) {
  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

export function useProjectOptional() {
  return useContext(ProjectContext);
}
