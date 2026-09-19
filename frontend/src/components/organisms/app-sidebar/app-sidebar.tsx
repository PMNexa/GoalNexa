import { NavLink } from "react-router-dom";
import { useOrgId } from "../../../hooks/useOrgId";
import { Icon } from "../../atoms/icon";

export interface AppSidebarProps {
  mobileOpen: boolean;
}

/**
 * Nav links are NOT permission-gated (a conscious simplification) - clicking
 * through to something you lack permission for just surfaces the 403 from
 * the API.
 *
 * Markup follows Tabler's navbar-vertical convention: aside.navbar-vertical >
 * .container-fluid > .navbar-collapse > ul.navbar-nav > li.nav-item > a.nav-link
 * with a .nav-link-icon / .nav-link-title split inside each link.
 */
export function AppSidebar({ mobileOpen }: AppSidebarProps) {
  const orgId = useOrgId();

  return (
    <aside className="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark">
      <div className="container-fluid">
        <h1 className="navbar-brand navbar-brand-autodark">
          <span className="fw-bold">GoalNexa</span>
        </h1>
        <div className={`navbar-collapse collapse${mobileOpen ? " show" : ""}`} id="sidebar-menu">
          <ul className="navbar-nav pt-lg-3">
            <li className="nav-item">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                <span className="nav-link-icon">
                  <Icon name="gauge" />
                </span>
                <span className="nav-link-title">Dashboard</span>
              </NavLink>
            </li>
            {orgId && (
              <>
                <li className="nav-item">
                  <NavLink
                    to={`/orgs/${orgId}/admin/goal`}
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                  >
                    <span className="nav-link-icon">
                      <Icon name="bullseye" />
                    </span>
                    <span className="nav-link-title">Goals</span>
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    to={`/orgs/${orgId}/members`}
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                  >
                    <span className="nav-link-icon">
                      <Icon name="users" />
                    </span>
                    <span className="nav-link-title">Members</span>
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
}
