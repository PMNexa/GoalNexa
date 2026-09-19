import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { entityConfigByKey } from "../../../entityConfigs";
import { getEntity, updateEntity } from "../../../lib/api/entityCrud";
import { EntityRow } from "../../../components/organisms/entity-table";
import { EntityForm } from "../../../components/organisms/entity-form";
import { Alert } from "../../../components/atoms/alert";
import { Spinner } from "../../../components/atoms/spinner";
import { ApiError } from "../../../lib/api/client";

export function EntityFormPage({ basePath }: { basePath: string }) {
  const { orgId, entity: entityKey, id } = useParams<{ orgId: string; entity: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const config = entityKey ? entityConfigByKey[entityKey] : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["entity-detail", entityKey, id],
    queryFn: () => getEntity<EntityRow>(config!, id!),
    enabled: !!config && !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => updateEntity(config!, id!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-list", entityKey] });
      queryClient.invalidateQueries({ queryKey: ["entity-detail", entityKey, id] });
      navigate(`${basePath.replace(":orgId", orgId ?? "")}/${entityKey}/${id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to save changes.");
    },
  });

  if (!config || !orgId || !id) {
    return <Alert color="danger">Unknown resource.</Alert>;
  }

  if (isLoading) return <Spinner />;
  if (isError || !data) return <Alert color="danger">Failed to load {config.resource}.</Alert>;

  return (
    <div>
      <h2 className="text-capitalize mb-3">Edit {config.resource}</h2>
      {error && <Alert color="danger">{error}</Alert>}
      <EntityForm
        config={config}
        lockedValues={{ [config.scopeField]: orgId }}
        initialValues={data}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync(values);
        }}
        submitting={updateMutation.isPending}
        submitLabel="Save changes"
      />
    </div>
  );
}
