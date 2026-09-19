import { ReactNode, useState } from "react";
import { AppHeader } from "../../organisms/app-header";
import { AppSidebar } from "../../organisms/app-sidebar";

export interface AppShellProps {
  children?: ReactNode;
}

/**
 * Tabler's page shell: .page > (header.navbar + aside.navbar-vertical +
 * .page-wrapper > .page-body). Mobile nav visibility is plain React state
 * (mobileOpen), not Bootstrap's JS bundle - that bundle isn't loaded here,
 * matching AppHeader's existing hand-rolled-dropdown convention.
 */
export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="page">
      <AppHeader mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((v) => !v)} />
      <AppSidebar mobileOpen={mobileOpen} />
      <div className="page-wrapper">
        <div className="page-body">
          <div className="container-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
