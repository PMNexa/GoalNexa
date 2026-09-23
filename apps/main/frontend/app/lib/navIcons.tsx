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

export const HomeIcon = (
  <Icon>
    <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
    <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
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

export const MetricsIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M13.41 10.59l2.59 -2.59" />
    <path d="M7 12a5 5 0 0 1 5 -5" />
  </Icon>
);

export const CheckInsIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 12l2 2l4 -4" />
  </Icon>
);

export const OrgsIcon = (
  <Icon>
    <path d="M3 21l18 0" />
    <path d="M9 8l1 0" />
    <path d="M9 12l1 0" />
    <path d="M9 16l1 0" />
    <path d="M14 8l1 0" />
    <path d="M14 12l1 0" />
    <path d="M14 16l1 0" />
    <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" />
  </Icon>
);
