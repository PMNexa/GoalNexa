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
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof schema>;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email, values.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthBoxLayout title="Sign in to GoalNexa">
      {error && <Alert color="danger">{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
        <Button type="submit" color="primary" className="w-100" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="text-center mt-3 mb-0">
        <Link to="/signup">Create an account</Link>
      </p>
    </AuthBoxLayout>
  );
}
