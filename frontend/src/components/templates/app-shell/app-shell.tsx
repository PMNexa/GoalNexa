import { ReactNode } from "react";
import { AppHeader } from "../../organisms/app-header";
import { AppSidebar } from "../../organisms/app-sidebar";

export interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-wrapper d-flex" style={{ minHeight: "100vh" }}>
      <AppSidebar />
      <div className="flex-fill d-flex flex-column" style={{ minWidth: 0 }}>
        <AppHeader />
        <main className="app-main flex-fill p-4">
          <div className="container-fluid">{children}</div>
        </main>
      </div>
    </div>
  );
}
