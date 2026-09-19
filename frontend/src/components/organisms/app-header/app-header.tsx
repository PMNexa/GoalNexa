import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../lib/api/client";
import { useAuth } from "../../../auth/AuthContext";
import { Icon } from "../../atoms/icon";

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface AppHeaderProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

/**
 * Hand-rolled dropdown (useState + document click-outside listener) -
 * deliberately not using Bootstrap's JS bundle / data-bs-toggle, since that
 * bundle isn't loaded in this app. The mobile navbar-toggler below follows
 * the same convention: it flips AppShell's mobileOpen state directly rather
 * than relying on data-bs-toggle="collapse".
 */
export function AppHeader({ mobileOpen, onToggleMobile }: AppHeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      // Fetch fresh every open - no caching between opens, since org
      // membership can change.
      setLoading(true);
      try {
        const data = await apiFetch<OrgSummary[]>("/auth/me/orgs");
        setOrgs(data);
      } catch {
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    }
  }

  function selectOrg(orgId: string) {
    setOpen(false);
    // Always navigate to the org root, never try to preserve the current
    // sub-route.
    navigate(`/orgs/${orgId}`);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="navbar navbar-expand-md d-print-none">
      <div className="container-xl">
        <button
          type="button"
          className="navbar-toggler"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={onToggleMobile}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <h1 className="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          GoalNexa
        </h1>

        <div className="navbar-nav flex-row order-md-last ms-auto align-items-center gap-2">
          <div className="dropdown position-relative" ref={containerRef}>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={toggleOpen}>
              <Icon name="building" className="me-1" />
              Switch org
            </button>
            {open && (
              <ul
                className="dropdown-menu show position-absolute end-0"
                style={{ display: "block" }}
              >
                {loading && <li className="dropdown-item-text">Loading...</li>}
                {!loading && orgs.length === 0 && <li className="dropdown-item-text">No organizations</li>}
                {!loading &&
                  orgs.map((org) => (
                    <li key={org.id}>
                      <button type="button" className="dropdown-item" onClick={() => selectOrg(org.id)}>
                        {org.name}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            <Icon name="right-from-bracket" className="me-1" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
