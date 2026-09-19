export interface IconProps {
  /** FontAwesome icon name without the "fa-" prefix, e.g. "user", "trash". */
  name: string;
  /** FontAwesome style class, defaults to solid. */
  variant?: "solid" | "regular" | "brands";
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<IconProps["variant"]>, string> = {
  solid: "fa-solid",
  regular: "fa-regular",
  brands: "fa-brands",
};

export function Icon({ name, variant = "solid", className }: IconProps) {
  const classNames = [VARIANT_CLASS[variant], `fa-${name}`, className].filter(Boolean).join(" ");
  return <i className={classNames} aria-hidden="true" />;
}
