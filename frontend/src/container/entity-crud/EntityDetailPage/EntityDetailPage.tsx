import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { entityConfigByKey } from "../../../entityConfigs";
import { getEntity, deleteEntity } from "../../../lib/api/entityCrud";
import { EntityRow } from "../../../components/organisms/entity-table";
import { usePermissions } from "../../../auth/usePermissions";
import { Alert } from "../../../components/atoms/alert";
import { Spinner } from "../../../components/atoms/spinner";
import { Button } from "../../../components/atoms/button";

export function EntityDetailPage({ basePath }: { basePath: string }) {
  const { orgId, entity: entityKey, id } = useParams<{ orgId: string; entity: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { has } = usePermissions(orgId);

  const config = entityKey ? entityConfigByKey[entityKey] : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["entity-detail", entityKey, id],
    queryFn: () => getEntity<EntityRow>(config!, id!),
    enabled: !!config && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEntity(config!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-list", entityKey] });
      navigate(`${basePath.replace(":orgId", orgId ?? "")}/${entityKey}`);
    },
  });

  if (!config || !orgId || !id) {
    return <Alert color="danger">Unknown resource.</Alert>;
  }

  if (isLoading) return <Spinner />;
  if (isError || !data) return <Alert color="danger">Failed to load {config.resource}.</Alert>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-capitalize mb-0">{config.resource} detail</h2>
        <div className="d-flex gap-2">
          {has(`${config.resource}.update`) && (
            <Button
              color="secondary"
              outline
              onClick={() => navigate(`${basePath.replace(":orgId", orgId)}/${entityKey}/${id}/edit`)}
            >
              Edit
            </Button>
          )}
          {has(`${config.resource}.delete`) && (
            <Button
              color="danger"
              outline
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete this ${config.resource}?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <dl className="row">
        {config.fields.map((field) => (
          <div className="col-12 col-md-6 mb-3" key={field.name}>
            <dt>{field.label}</dt>
            <dd>{formatValue(data[field.name])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
