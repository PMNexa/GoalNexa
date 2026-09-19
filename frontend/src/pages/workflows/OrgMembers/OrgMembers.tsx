import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useOrgId } from "../../../hooks/useOrgId";
import { apiFetch, ApiError } from "../../../lib/api/client";
import { usePermissions } from "../../../auth/usePermissions";
import { Card } from "../../../components/atoms/card";
import { Button } from "../../../components/atoms/button";
import { Alert } from "../../../components/atoms/alert";
import { Spinner } from "../../../components/atoms/spinner";
import { FormField } from "../../../components/molecules/form-field";

interface OrgMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  status: "active" | "suspended" | string;
  joined_at: string | null;
}

const inviteSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});
type InviteValues = z.infer<typeof inviteSchema>;

function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    void navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure-context origins (plain HTTP on a LAN IP, common
  // for self-hosted setups).
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function OrgMembers() {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { has } = usePermissions(orgId);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const {
    data: members,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => apiFetch<OrgMember[]>(`/orgs/${orgId}/members`),
    enabled: !!orgId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });

  const inviteMutation = useMutation({
    mutationFn: (values: InviteValues) =>
      apiFetch<{ invite_link: string }>(`/orgs/${orgId}/members/invite`, {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (result) => {
      setInviteLink(result.invite_link);
      setInviteError(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (err) => {
      setInviteError(err instanceof ApiError ? err.message : "Failed to send invite.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: "active" | "suspended" }) =>
      apiFetch(`/orgs/${orgId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
  });

  return (
    <div>
      <h2 className="mb-4">Members</h2>

      {has("org_membership.invite") && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title>Invite a member</Card.Title>
            {inviteError && <Alert color="danger">{inviteError}</Alert>}
            {inviteLink && (
              <Alert color="success">
                Invite link created:{" "}
                <code>{inviteLink}</code>{" "}
                <Button size="sm" color="secondary" outline onClick={() => copyToClipboard(inviteLink)}>
                  Copy
                </Button>
              </Alert>
            )}
            <form
              className="d-flex align-items-start gap-2"
              onSubmit={handleSubmit((values) => inviteMutation.mutateAsync(values))}
              noValidate
            >
              <div className="flex-fill">
                <FormField
                  id="invite-email"
                  label="Email"
                  type="email"
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>
              <Button type="submit" color="primary" disabled={inviteMutation.isPending} className="mt-4">
                {inviteMutation.isPending ? "Sending..." : "Invite"}
              </Button>
            </form>
          </Card.Body>
        </Card>
      )}

      {isLoading && <Spinner />}
      {isError && <Alert color="danger">Failed to load members.</Alert>}

      {members && (
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  No members yet.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>
                  <span className={`badge text-bg-${member.status === "active" ? "success" : "secondary"}`}>
                    {member.status}
                  </span>
                </td>
                <td>{member.joined_at ?? "-"}</td>
                <td>
                  {has("org_membership.update") && (
                    <Button
                      size="sm"
                      color={member.status === "active" ? "warning" : "success"}
                      outline
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          memberId: member.id,
                          status: member.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      {member.status === "active" ? "Suspend" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
