import { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonColor = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "link";
export type ButtonSize = "sm" | "default" | "lg";

const COLOR_CLASS: Record<ButtonColor, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  success: "btn-success",
  danger: "btn-danger",
  warning: "btn-warning",
  info: "btn-info",
  link: "btn-link",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  default: "",
  lg: "btn-lg",
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  color?: ButtonColor;
  outline?: boolean;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  color = "primary",
  outline = false,
  size = "default",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const colorClass = outline ? `btn-outline-${color}` : COLOR_CLASS[color];
  const classNames = ["btn", colorClass, SIZE_CLASS[size], className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classNames} {...rest}>
      {children}
    </button>
  );
}
