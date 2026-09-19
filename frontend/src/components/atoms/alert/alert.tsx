import { HTMLAttributes, ReactNode } from "react";

export type AlertColor = "primary" | "secondary" | "success" | "danger" | "warning" | "info";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  color?: AlertColor;
  children?: ReactNode;
}

export function Alert({ color = "danger", className, children, ...rest }: AlertProps) {
  return (
    <div className={["alert", `alert-${color}`, className].filter(Boolean).join(" ")} role="alert" {...rest}>
      {children}
    </div>
  );
}
