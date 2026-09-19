import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { AuthBoxLayout } from "../../../components/templates/auth-box-layout";
import { FormField } from "../../../components/molecules/form-field";
import { Button } from "../../../components/atoms/button";
import { Alert } from "../../../components/atoms/alert";
import { ApiError } from "../../../lib/api/client";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  orgName: z.string().trim().min(1, "Organization name is required"),
  orgSlug: z
    .string()
    .trim()
    .min(1, "Organization slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
});

type SignupValues = z.infer<typeof schema>;

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: SignupValues) {
    setSubmitting(true);
    setError(null);
    try {
      await signup(values.email, values.password, values.name, values.orgName, values.orgSlug);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthBoxLayout title="Create your GoalNexa account">
      {error && <Alert color="danger">{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id="name" label="Name" error={errors.name?.message} {...register("name")} />
        <FormField
          id="email"
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          error={errors.password?.message}
          {...register("password")}
        />
        <FormField
          id="orgName"
          label="Organization name"
          error={errors.orgName?.message}
          {...register("orgName")}
        />
        <FormField
          id="orgSlug"
          label="Organization slug"
          error={errors.orgSlug?.message}
          {...register("orgSlug")}
        />
        <Button type="submit" color="primary" className="w-100" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>
      <p className="text-center mt-3 mb-0">
        <Link to="/login">Already have an account? Sign in</Link>
      </p>
    </AuthBoxLayout>
  );
}
