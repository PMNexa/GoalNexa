import { useParams } from "react-router-dom";

/**
 * Single-level tenancy: reads :orgId straight from the route params. No
 * project-scope resolution is needed for this app.
 */
export function useOrgId(): string | undefined {
  const { orgId } = useParams<{ orgId: string }>();
  return orgId;
}
