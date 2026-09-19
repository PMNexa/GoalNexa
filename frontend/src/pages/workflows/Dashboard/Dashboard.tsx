import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../../lib/api/client";
import { OrgSummary } from "../../../auth/AuthContext";
import { Card } from "../../../components/atoms/card";
import { Button } from "../../../components/atoms/button";
import { Alert } from "../../../components/atoms/alert";
import { Spinner } from "../../../components/atoms/spinner";
import { Modal } from "../../../components/molecules/modal";
import { FormField } from "../../../components/molecules/form-field";

const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and hyphens"),
});

type CreateOrgValues = z.infer<typeof createOrgSchema>;

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: orgs, isLoading, isError } = useQuery({
    queryKey: ["my-orgs"],
    // Fetched fresh on mount rather than reused from AuthContext, which only
    // reflects org membership as of the last login.
    queryFn: () => apiFetch<OrgSummary[]>("/auth/me/orgs"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrgValues>({ resolver: zodResolver(createOrgSchema) });

  async function onCreateOrg(values: CreateOrgValues) {
    setSubmitting(true);
    setCreateError(null);
    try {
      const org = await apiFetch<OrgSummary>("/orgs", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["my-orgs"] });
      navigate(`/orgs/${org.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create organization.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }

  if (isError || !orgs) {
    return <Alert color="danger">Failed to load your organizations.</Alert>;
  }

  if (orgs.length === 1) {
    return <Navigate to={`/orgs/${orgs[0].id}`} replace />;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Your organizations</h2>
        <Button
          color="primary"
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
          }}
        >
          Create organization
        </Button>
      </div>

      {orgs.length === 0 && (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="mb-3">You are not a member of any organization yet.</p>
            <Button color="primary" onClick={() => setShowCreate(true)}>
              Create organization
            </Button>
          </Card.Body>
        </Card>
      )}

      {orgs.length >= 2 && (
        <div className="row g-3">
          {orgs.map((org) => (
            <div className="col-12 col-md-4" key={org.id}>
              <Card
                className="h-100"
                role="button"
                onClick={() => navigate(`/orgs/${org.id}`)}
                style={{ cursor: "pointer" }}
              >
                <Card.Body>
                  <Card.Title>{org.name}</Card.Title>
                  <p className="text-muted mb-0">{org.slug}</p>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal
        show={showCreate}
        title="Create organization"
        onClose={() => {
          setShowCreate(false);
          setCreateError(null);
        }}
      >
        <Modal.Body>
          {createError && <Alert color="danger">{createError}</Alert>}
          <form onSubmit={handleSubmit(onCreateOrg)} noValidate>
            <FormField id="name" label="Name" error={errors.name?.message} {...register("name")} />
            <FormField id="slug" label="Slug" error={errors.slug?.message} {...register("slug")} />
            <Button type="submit" color="primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
}
