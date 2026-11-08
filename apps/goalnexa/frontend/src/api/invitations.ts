import { apiRequest } from "./client";

/**
 * Invitations sent to the signed-in user's email - platform-org's invitee
 * side (`/api/v1/org-invitations/received`, `token/<token>/accept|decline`),
 * HTTP only like `dashboard.ts`.
 */
export interface ReceivedInvitation {
  id: string;
  token: string;
  role: "owner" | "admin" | "member";
  org: { id: string; name: string };
  invited_by: { id: string; name: string | null; email: string | null };
}

/** Open invitations to orgs the user isn't in yet ([] on a host without platform-org). */
export function fetchReceivedInvitations(accessToken: string): Promise<ReceivedInvitation[]> {
  return apiRequest<{ items: ReceivedInvitation[] }>("/api/v1/org-invitations/received", accessToken)
    .then((body) => body.items ?? [])
    .catch(() => []);
}

export function acceptInvitation(accessToken: string, token: string): Promise<{ org: { id: string; name: string } }> {
  return apiRequest(`/api/v1/org-invitations/token/${encodeURIComponent(token)}/accept`, accessToken, {
    method: "POST",
  });
}

export function declineInvitation(accessToken: string, token: string): Promise<void> {
  return apiRequest(`/api/v1/org-invitations/token/${encodeURIComponent(token)}/decline`, accessToken, {
    method: "POST",
  });
}
