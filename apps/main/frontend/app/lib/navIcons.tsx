import type { ReactNode } from "react";

/**
 * Sidebar icons (Tabler Icons' outline set, MIT - inlined, no icon font
 * loaded). Every nav item has one so the folded sidebar rail stays
 * readable; AppShell falls back to a first letter for any that doesn't.
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (
  <Icon>
    <path d="M4 19l16 0" />
    <path d="M4 15l4 -6l4 2l4 -5l4 4" />
  </Icon>
);

export const GoalsIcon = (
  <Icon>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="9" />
  </Icon>
);
