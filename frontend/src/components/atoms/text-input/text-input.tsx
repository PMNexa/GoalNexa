import { forwardRef, InputHTMLAttributes } from "react";

export type TextInputSize = "sm" | "default" | "lg";

const SIZE_CLASS: Record<TextInputSize, string> = {
  sm: "form-control-sm",
  default: "",
  lg: "form-control-lg",
};

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  size?: TextInputSize;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid = false, size = "sm", className, ...rest },
  ref,
) {
  const classNames = ["form-control", SIZE_CLASS[size], invalid ? "is-invalid" : "", className]
    .filter(Boolean)
    .join(" ");
  return <input ref={ref} className={classNames} {...rest} />;
});
