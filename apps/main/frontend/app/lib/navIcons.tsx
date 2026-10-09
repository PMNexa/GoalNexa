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

export const TableIcon = (
  <Icon>
    <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" />
    <path d="M3 10h18" />
    <path d="M10 3v18" />
  </Icon>
);

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

export const BackIcon = (
  <Icon>
    <path d="M5 12l14 0" />
    <path d="M5 12l6 6" />
    <path d="M5 12l6 -6" />
  </Icon>
);
