import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodTypeAny } from "zod";
import { EntityConfig, FieldConfig } from "../../../entityConfigs/types";
import { FormField } from "../../molecules/form-field";
import { Button } from "../../atoms/button";

export interface EntityFormProps {
  config: EntityConfig;
  /** Values fixed by route context (e.g. org_id) - excluded from the editable
   * form and the zod schema entirely. */
  lockedValues?: Record<string, unknown>;
  /** Present in edit mode to prefill the form. */
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
}

function fieldSchema(field: FieldConfig): ZodTypeAny {
  switch (field.type) {
    case "enum": {
      const values = (field.values ?? []) as [string, ...string[]];
      const base = z.enum(values);
      return field.required ? base : base.optional();
    }
    case "date": {
      const base = z.string().trim().min(1, `${field.label} is required`);
      return field.required ? base : z.string().optional();
    }
    case "boolean":
      return z.boolean().optional();
    case "string":
    case "text":
    default: {
      const base = z.string().trim();
      return field.required ? base.min(1, `${field.label} is required`) : base.optional();
    }
  }
}

function buildSchema(fields: FieldConfig[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.name] = fieldSchema(field);
  }
  return z.object(shape);
}

export function EntityForm({
  config,
  lockedValues = {},
  initialValues,
  onSubmit,
  submitting = false,
  submitLabel = "Save",
}: EntityFormProps) {
  const editableFields = config.fields.filter((field) => !field.readOnly && !(field.name in lockedValues));
  const schema = buildSchema(editableFields);
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues as FormValues | undefined,
  });

  function submit(values: FormValues) {
    return onSubmit(values as Record<string, unknown>);
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      {editableFields.map((field) => {
        const error = (errors as Record<string, { message?: string } | undefined>)[field.name]?.message;

        if (field.type === "enum") {
          return (
            <div className="mb-3" key={field.name}>
              <label className="form-label" htmlFor={field.name}>
                {field.label}
              </label>
              <select
                id={field.name}
                className={["form-select", error ? "is-invalid" : ""].filter(Boolean).join(" ")}
                {...register(field.name)}
              >
                {!field.required && <option value="">--</option>}
                {(field.values ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {error && (
                <div className="invalid-feedback d-block" role="alert">
                  {error}
                </div>
              )}
            </div>
          );
        }

        if (field.type === "boolean") {
          return (
            <div className="mb-3 form-check" key={field.name}>
              <input
                id={field.name}
                type="checkbox"
                className="form-check-input"
                {...register(field.name)}
              />
              <label className="form-check-label" htmlFor={field.name}>
                {field.label}
              </label>
            </div>
          );
        }

        if (field.type === "text") {
          return (
            <div className="mb-3" key={field.name}>
              <label className="form-label" htmlFor={field.name}>
                {field.label}
              </label>
              <textarea
                id={field.name}
                className={["form-control", error ? "is-invalid" : ""].filter(Boolean).join(" ")}
                rows={4}
                {...register(field.name)}
              />
              {error && (
                <div className="invalid-feedback d-block" role="alert">
                  {error}
                </div>
              )}
            </div>
          );
        }

        return (
          <FormField
            key={field.name}
            id={field.name}
            label={field.label}
            type={field.type === "date" ? "date" : "text"}
            error={error}
            {...register(field.name)}
          />
        );
      })}

      <Button type="submit" color="primary" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
