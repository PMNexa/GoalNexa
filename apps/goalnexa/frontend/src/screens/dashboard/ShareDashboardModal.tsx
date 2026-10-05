import { useEffect, useState, type FormEvent } from "react";
import { Button, CopyButton, FormControl, FormLabel, Modal } from "platform-core";
import type { Goal } from "../../lib/api/goals";
import { createShare, deleteShare, fetchShares, type DashboardShare } from "../../lib/api/shares";

export interface ShareDashboardModalProps {
  open: boolean;
  accessToken: string;
  /** The goals shown on the dashboard, in color-slot order - what a new link shows. */
  goals: Goal[];
  /** Metrics unticked on the dashboard - left off the link too. */
  hiddenMetrics: string[];
  /** Suggested link name (the org and cycle picked). */
  defaultTitle: string;
  /** A token's full URL - the host decides where that page lives. */
  shareUrl: (token: string) => string;
  onClose: () => void;
}

const created = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Public, read-only links to the dashboard: "Create link" for the goals
 * shown now, then copy it; below, every link this user made, each
 * revocable. A link is live - it shows the goals' progress as it is when
 * opened, without notes or who checked in (`views/shares.py`).
 */
function ShareDashboardModal({
  open,
  accessToken,
  goals,
  hiddenMetrics,
  defaultTitle,
  shareUrl,
  onClose,
}: ShareDashboardModalProps) {
  const [shares, setShares] = useState<DashboardShare[] | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [justCreated, setJustCreated] = useState<DashboardShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTitle(defaultTitle);
    setJustCreated(null);
    setError(null);
    fetchShares(accessToken)
      .then((items) => !cancelled && setShares(items))
      .catch((thrown: unknown) => !cancelled && setError(thrown instanceof Error ? thrown.message : String(thrown)));
    return () => {
      cancelled = true;
    };
    // Reset on open only - not while the dashboard behind it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const share = await createShare(accessToken, {
        title: title.trim(),
        goals: goals.map((goal) => goal.id),
        hidden_metrics: hiddenMetrics,
      });
      setJustCreated(share);
      setShares((prev) => [share, ...(prev ?? [])]);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: DashboardShare) {
    setBusy(true);
    setError(null);
    try {
      await deleteShare(accessToken, share.id);
      setShares((prev) => prev?.filter((row) => row.id !== share.id) ?? prev);
      if (justCreated?.id === share.id) setJustCreated(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  const goalCount = (n: number) => `${n} goal${n === 1 ? "" : "s"}`;

  return (
    <Modal open={open} title="Share dashboard" onClose={onClose}>
      {justCreated ? (
        <div className="mb-3">
          <FormLabel htmlFor="share-link">Anyone with this link can see it</FormLabel>
          <div className="d-flex gap-2">
            <FormControl id="share-link" readOnly value={shareUrl(justCreated.token)} onFocus={(e) => e.target.select()} />
            <CopyButton text={shareUrl(justCreated.token)} />
          </div>
        </div>
      ) : goals.length === 0 ? (
        <p className="text-secondary">Show one or more goals first - a link shows the goals on your dashboard.</p>
      ) : (
        <form onSubmit={create} className="mb-3">
          <p className="text-secondary">
            Anyone with the link sees the progress of {goals.map((goal) => goal.title).join(", ")} - live, read-only, no
            sign-in. Check-in notes and who checked in stay private.
          </p>
          <FormLabel htmlFor="share-title">Name</FormLabel>
          <div className="d-flex gap-2">
            <FormControl id="share-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
            <Button type="submit" variant="primary" disabled={busy} className="text-nowrap">
              Create link
            </Button>
          </div>
        </form>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {shares !== null && shares.length > 0 && (
        <>
          <div className="form-label">Your links</div>
          <ul className="list-group list-group-flush">
            {shares.map((share) => (
              <li key={share.id} className="list-group-item px-0 d-flex align-items-center gap-2">
                <div className="flex-fill text-truncate">
                  <a href={shareUrl(share.token)} target="_blank" rel="noreferrer">
                    {share.title || "Untitled"}
                  </a>
                  <div className="text-secondary small">
                    {goalCount(share.goals.length)} · {created.format(new Date(share.created_at))}
                  </div>
                </div>
                <CopyButton text={shareUrl(share.token)} />
                <Button variant="danger" outline disabled={busy} onClick={() => void revoke(share)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

export default ShareDashboardModal;
