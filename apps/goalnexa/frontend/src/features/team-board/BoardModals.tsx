import { Button, Modal, useT } from "platform-core";
import messages from "./messages";
import type { EditTarget } from "./boardHelpers";
import type { Row } from "./boardRows";

/** A team (or member) row unticked in Targets mode: "Take out" confirms it leaves the template in this cycle. */
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
  const t = useT(messages);
  const name = leaving?.label ?? "";
  const member = !!leaving?.person;
  return (
    <Modal
      open={leaving !== null}
      onClose={() => !busy && onCancel()}
      size="sm"
      title={leaving ? t(member ? "leaveMemberTitle" : "leaveTeamTitle", { name }) : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {t("takeOut")}
          </Button>
        </>
      }
    >
      {leaving && (
        <p className="mb-0">
          {Object.values(leaving.instance?.metrics ?? {}).some((m) => m.last_checked_in_at)
            ? t(member ? "hasCheckInsMember" : "hasCheckInsTeam", { name })
            : t("copyDeleted", { name })}{" "}
          {member ? t("memberTail") : `${leaving.memberCount ? t("membersCopiesToo") : ""}${t("teamTail")}`}
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
  const t = useT(messages);
  return (
    <Modal
      open={removing !== null}
      onClose={() => !busy && onCancel()}
      size="sm"
      title={removing ? t("removeTitle", { name: removing.name }) : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {t("remove")}
          </Button>
        </>
      }
    >
      {removing && (
        <p className="mb-0">
          {removing.endpoint === "/api/v1/template-metrics"
            ? t("removeMetricText")
            : t("removeGoalText")}{" "}
          {t("removeKept")}
        </p>
      )}
    </Modal>
  );
}
