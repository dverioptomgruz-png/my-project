"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";
import { useApi } from "./use-api";
import type { PaginatedResponse, Project } from "@/types";

/**
 * Hook to fetch the current user's project list.
 *
 * @returns Object with projects list, loading, error, and refetch
 *
 * @example
 * ```tsx
 * const { projects, loading, error, refetch } = useProjects();
 * ```
 */
export function useProjects() {
  const fetchProjects = useCallback(async () => {
    const { data } = await api.get<PaginatedResponse<Project>>("/projects");
    return data;
  }, []);

  const { data, loading, error, refetch } = useApi(fetchProjects);

  return {
    projects: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch a single project by its ID.
 *
 * @param id - The project ID to fetch
 * @returns Object with project data, loading, error, and refetch
 *
 * @example
 * ```tsx
 * const { project, loading, error, refetch } = useProject("abc-123");
 * ```
 */
export function useProject(id: string) {
  const fetchProject = useCallback(async () => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  }, [id]);

  const { data, loading, error, refetch } = useApi(fetchProject, !!id);

  return {
    project: data,
    loading,
    error,
    refetch,
  };
}
