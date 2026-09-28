import { useEffect, useMemo, useState } from "react";
import { createRequest, createSchemaFields, CrudFormModal, loadSchema, Modal, type CrudField } from "platform-core";

type Row = Record<string, unknown>;

/** What to create from the dashboard tree, and where it hangs. */
export interface CreateTarget {
  endpoint: "/api/v1/goals" | "/api/v1/metrics";
  title: string;
  /** Sent as-is and left out of the form: the org, goal and/or parent the tree position implies. */
  preset: Row;
}

export interface CreateRecordModalProps {
  accessToken: string;
  /** `null` = closed. */
  target: CreateTarget | null;
  onCreated: (row: Row) => void;
  onClose: () => void;
}

/**
 * The dashboard's "New goal" / "Add metric" / "Add sub-…" form: the
 * resource's schema-driven fields in platform-core's `CrudFormModal`,
 * minus what the tree already decides (`preset`). `parent` is never a
 * form field here - its picker would list every row of the resource, and
 * the tree position is the parent.
 */
function CreateRecordModal({ accessToken, target, onCreated, onClose }: CreateRecordModalProps) {
  const request = useMemo(() => createRequest(accessToken), [accessToken]);
  const endpoint = target?.endpoint ?? null;
  const [loaded, setLoaded] = useState<{ endpoint: string; fields: CrudField<Row>[] } | null>(null);
  const [failed, setFailed] = useState<{ endpoint: string; message: string } | null>(null);

  useEffect(() => {
    if (endpoint === null) return;
    let cancelled = false;
    loadSchema(endpoint, request)
      .then((schema) => !cancelled && setLoaded({ endpoint, fields: createSchemaFields<Row>(schema) }))
      .catch((thrown: unknown) => !cancelled && setFailed({ endpoint, message: thrown instanceof Error ? thrown.message : String(thrown) }));
    return () => {
      cancelled = true;
    };
  }, [endpoint, request]);

  const fields = useMemo(
    () =>
      loaded && target && loaded.endpoint === target.endpoint
        ? loaded.fields.filter((field) => field.key !== "parent" && !(field.key in target.preset))
        : null,
    [loaded, target],
  );

  // loadSchema drops a failed fetch, so reopening retries.
  const error = failed && target && fields === null && failed.endpoint === target.endpoint ? failed.message : null;
  if (error && target) {
    return (
      <Modal open title={target.title} onClose={onClose}>
        <p className="text-danger mb-0" role="alert">
          {error}
        </p>
      </Modal>
    );
  }
  return (
    <CrudFormModal
      open={target !== null && fields !== null}
      title={target?.title ?? ""}
      fields={fields ?? []}
      request={request}
      submitLabel="Create"
      onSubmit={async (values) => {
        if (!target) return;
        const row = await request<Row>(target.endpoint, {
          method: "POST",
          body: JSON.stringify({ ...values, ...target.preset }),
        });
        onCreated(row);
      }}
      onClose={onClose}
    />
  );
}

export default CreateRecordModal;
