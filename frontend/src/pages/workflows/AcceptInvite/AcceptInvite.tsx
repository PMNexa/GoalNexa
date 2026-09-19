import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { AuthBoxLayout } from "../../../components/templates/auth-box-layout";
import { FormField } from "../../../components/molecules/form-field";
import { Button } from "../../../components/atoms/button";
import { Alert } from "../../../components/atoms/alert";
import { ApiError } from "../../../lib/api/client";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AcceptInviteValues = z.infer<typeof schema>;

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: AcceptInviteValues) {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvite(token, values.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invite. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthBoxLayout title="Accept your invitation">
      {error && <Alert color="danger">{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          id="password"
          label="Password"
          type="password"
          error={errors.password?.message}
          {...register("password")}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" color="primary" className="w-100" disabled={submitting}>
          {submitting ? "Setting up..." : "Accept invite"}
        </Button>
      </form>
    </AuthBoxLayout>
  );
}
