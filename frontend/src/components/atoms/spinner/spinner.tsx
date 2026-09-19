export interface SpinnerProps {
  size?: "sm" | "default";
  label?: string;
}

export function Spinner({ size = "default", label = "Loading..." }: SpinnerProps) {
  const classNames = ["spinner-border", size === "sm" ? "spinner-border-sm" : ""].filter(Boolean).join(" ");
  return (
    <div className={classNames} role="status">
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
