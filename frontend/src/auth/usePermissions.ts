import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api/client";

export interface PermissionEntry {
  permission_code: string;
  org_id: string;
}

export interface UsePermissionsResult {
  has: (code: string) => boolean;
  isLoading: boolean;
}

export function usePermissions(orgId: string | undefined): UsePermissionsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["permissions-mine", orgId],
    queryFn: () => apiFetch<PermissionEntry[]>(`/orgs/${orgId}/permissions/mine`),
    enabled: !!orgId,
  });

  function has(code: string): boolean {
    // Fail closed: while loading or on error, a gated affordance stays
    // hidden rather than flashing then vanishing.
    if (isLoading || isError || !data) return false;
    return data.some((entry) => entry.permission_code === code);
  }

  return { has, isLoading };
}
