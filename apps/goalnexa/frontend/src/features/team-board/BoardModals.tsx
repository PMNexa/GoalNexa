import { Button, Modal } from "platform-core";
import type { EditTarget } from "./boardHelpers";
import type { Row } from "./boardRows";

/** A team row unticked in Targets mode: "Take out" confirms it leaves the template in this cycle. */
export function LeaveTemplateModal({
  leaving,
  busy,
  onCancel,
  onConfirm,
}: {
  /** The unticked row, or null (closed). */
  leaving: Row | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={leaving !== null}
      onClose={() => !busy && onCancel()}
      size="sm"
      title={leaving?.team ? `Take ${leaving.team.name} out of the template?` : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            Take out
          </Button>
        </>
      }
    >
      {leaving?.team && (
        <p className="mb-0">
          {Object.values(leaving.instance?.metrics ?? {}).some((m) => m.last_checked_in_at)
            ? `${leaving.team.name} has check-ins: its goals and their history stay, as ${leaving.team.name}'s own goals, no longer part of the template.`
            : `${leaving.team.name}'s copy of the template and its targets are deleted.`}{" "}
          The totals above it stop counting it. Tick it again to start a fresh copy.
        </p>
      )}
    </Modal>
  );
}

/** A column header's "×": "Remove" confirms the goal or metric leaves the template. */
export function RemoveFromTemplateModal({
  removing,
  busy,
  onCancel,
  onConfirm,
}: {
  /** The goal or metric to remove, or null (closed). */
  removing: (EditTarget & { name: string }) | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={removing !== null}
      onClose={() => !busy && onCancel()}
      size="sm"
      title={removing ? `Remove "${removing.name}"?` : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            Remove
          </Button>
        </>
      }
    >
      {removing && (
        <p className="mb-0">
          {removing.endpoint === "/api/v1/template-metrics"
            ? "The metric and its sub-metrics leave the template and every team's copy, and the totals drop it."
            : "The goal, its sub-goals and their metrics leave the template and every team's copy, and the totals drop them."}{" "}
          A team's copy that already has check-ins is kept as that team's own, no longer part of the template.
        </p>
      )}
    </Modal>
  );
}
