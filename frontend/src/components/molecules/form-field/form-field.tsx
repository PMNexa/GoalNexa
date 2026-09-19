import { forwardRef, InputHTMLAttributes } from "react";
import { TextInput, TextInputSize } from "../../atoms/text-input";

/**
 * Composes TextInput. Uncontrolled - meant to be bound via React Hook Form's
 * register() spread as rest props (this codebase never uses RHF's
 * Controller). `value` is omitted from the prop surface accordingly.
 */
export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "size" | "value"> {
  id: string;
  label: string;
  type?: string;
  error?: string;
  size?: TextInputSize;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { id, label, type = "text", error, size, ...rest },
  ref,
) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <TextInput id={id} type={type} size={size} invalid={Boolean(error)} ref={ref} {...rest} />
      {error && (
        <div className="invalid-feedback d-block" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});
