import { NavLink } from "react-router-dom";
import { useOrgId } from "../../../hooks/useOrgId";
import { Icon } from "../../atoms/icon";

/**
 * Nav links are NOT permission-gated (a conscious simplification) - clicking
 * through to something you lack permission for just surfaces the 403 from
 * the API.
 */
export function AppSidebar() {
  const orgId = useOrgId();

  return (
    <aside className="app-sidebar bg-body-tertiary shadow" data-bs-theme="dark">
      <div className="sidebar-brand p-3">
        <span className="fw-bold">GoalNexa</span>
      </div>
      <div className="sidebar-wrapper">
        <nav className="mt-2">
          <ul className="nav sidebar-menu flex-column">
            <li className="nav-item">
              <NavLink to="/dashboard" className="nav-link">
                <Icon name="gauge" className="me-2" />
                Dashboard
              </NavLink>
            </li>
            {orgId && (
              <>
                <li className="nav-item">
                  <NavLink to={`/orgs/${orgId}/admin/goal`} className="nav-link">
                    <Icon name="bullseye" className="me-2" />
                    Goals
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to={`/orgs/${orgId}/members`} className="nav-link">
                    <Icon name="users" className="me-2" />
                    Members
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
