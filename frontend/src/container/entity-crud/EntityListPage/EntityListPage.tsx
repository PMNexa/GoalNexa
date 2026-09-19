import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { entityConfigByKey } from "../../../entityConfigs";
import { listEntities, createEntity, ListResult } from "../../../lib/api/entityCrud";
import { usePermissions } from "../../../auth/usePermissions";
import { EntityTable, EntityRow } from "../../../components/organisms/entity-table";
import { EntityForm } from "../../../components/organisms/entity-form";
import { Modal } from "../../../components/molecules/modal";
import { Pagination } from "../../../components/molecules/pagination";
import { Button } from "../../../components/atoms/button";
import { Alert } from "../../../components/atoms/alert";
import { Spinner } from "../../../components/atoms/spinner";
import { ApiError } from "../../../lib/api/client";

const PAGE_SIZE = 20;

export function EntityListPage({ basePath }: { basePath: string }) {
  const { orgId, entity: entityKey } = useParams<{ orgId: string; entity: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const config = entityKey ? entityConfigByKey[entityKey] : undefined;
  const { has } = usePermissions(orgId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["entity-list", entityKey, orgId, page, PAGE_SIZE, sort, q],
    queryFn: () =>
      listEntities<EntityRow>(config!, { orgId: orgId!, page, pageSize: PAGE_SIZE, sort, q }),
    enabled: !!config && !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      createEntity(config!, { ...values, [config!.scopeField]: orgId }),
    onSuccess: () => {
      setShowCreate(false);
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["entity-list", entityKey] });
    },
    onError: (err) => {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create record.");
    },
  });

  if (!config || !orgId) {
    return <Alert color="danger">Unknown resource.</Alert>;
  }

  function handleSortChange(fieldName: string) {
    setSort((current) => {
      if (current === fieldName) return `-${fieldName}`;
      if (current === `-${fieldName}`) return undefined;
      return fieldName;
    });
    setPage(1);
  }

  const result = data as ListResult<EntityRow> | undefined;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-capitalize mb-0">{config.resource}s</h2>
        {has(`${config.resource}.create`) && (
          <Button color="primary" onClick={() => setShowCreate(true)}>
            New {config.resource}
          </Button>
        )}
      </div>

      {config.searchFields && config.searchFields.length > 0 && (
        <div className="mb-3">
          <input
            type="search"
            className="form-control"
            placeholder="Search..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      {isLoading && <Spinner />}
      {isError && <Alert color="danger">Failed to load {config.resource}s.</Alert>}

      {result && (
        <>
          <EntityTable
            config={config}
            items={result.items}
            sort={sort}
            onSortChange={handleSortChange}
            onRowClick={(item) => navigate(`${basePath.replace(":orgId", orgId)}/${entityKey}/${item.id}`)}
          />
          <Pagination page={result.page} pageSize={result.page_size} total={result.total} onPageChange={setPage} />
        </>
      )}

      <Modal
        show={showCreate}
        title={`New ${config.resource}`}
        onClose={() => {
          setShowCreate(false);
          setCreateError(null);
        }}
      >
        <Modal.Body>
          {createError && <Alert color="danger">{createError}</Alert>}
          <EntityForm
            config={config}
            lockedValues={{ [config.scopeField]: orgId }}
            onSubmit={async (values) => {
              await createMutation.mutateAsync(values);
            }}
            submitting={createMutation.isPending}
            submitLabel="Create"
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
