import { useState } from "react";
import { Button, useT } from "platform-core";
import { acceptInvitation, declineInvitation, type ReceivedInvitation } from "../../api/invitations";
import messages from "./messages";

export interface PendingInvitationsProps {
  accessToken: string;
  invitations: ReceivedInvitation[];
  /** After joining: the org to open. */
  onAccepted: (org: { id: string; name: string }) => void;
  onDeclined: (invitation: ReceivedInvitation) => void;
}

/**
 * Open invitations to the user's email, each with Accept / Decline - shown
 * before onboarding so an invited person joins their team's organization
 * instead of creating one of their own, and above the dashboard after.
 */
function PendingInvitations({ accessToken, invitations, onAccepted, onDeclined }: PendingInvitationsProps) {
  const t = useT(messages);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (invitation: ReceivedInvitation, accept: boolean) => {
    setBusy(invitation.token);
    setError(null);
    try {
      if (accept) onAccepted((await acceptInvitation(accessToken, invitation.token)).org);
      else {
        await declineInvitation(accessToken, invitation.token);
        onDeclined(invitation);
      }
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="d-flex flex-column gap-2">
      {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}
      {invitations.map((invitation) => (
        <div
          key={invitation.token}
          className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded p-3"
        >
          <div>
            <div className="fw-semibold">{t("inviteTitle", { org: invitation.org.name })}</div>
            <div className="text-secondary small">
              {t("inviteFrom", {
                name: invitation.invited_by.name || invitation.invited_by.email || t("someone"),
                role: t(`role_${invitation.role}`),
              })}
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" disabled={busy !== null} onClick={() => void run(invitation, false)}>
              {t("decline")}
            </Button>
            <Button variant="primary" disabled={busy !== null} onClick={() => void run(invitation, true)}>
              {busy === invitation.token ? t("joining") : t("accept")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PendingInvitations;
