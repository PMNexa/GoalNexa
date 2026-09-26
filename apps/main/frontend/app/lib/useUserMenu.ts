import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { UserMenuEntry } from "platform-core";
import { hasPermission } from "platform-auth-frontend";
import { fetchOrgs, getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg, type OrgOption } from "goalnexa-frontend";

/**
 * The header's user dropdown (above "Log out"): switch organization - the
 * org the dashboard shows (goalnexa's current org), so picking one opens
 * the dashboard on it - then "Manage organizations" (platform-org's list,
 * where an org's page manages members and invitations). The org list is
 * refreshed each time the menu opens (`refresh`), so an org created or
 * joined since shows up. Without `orgs.view` the org section is left out.
 */
export function useUserMenu(accessToken: string | null, permissions: string[] | null) {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const canViewOrgs = hasPermission(permissions, "orgs.view");

  const refresh = useCallback(() => {
    if (!accessToken || !canViewOrgs) return;
    fetchOrgs(accessToken)
      .then(setOrgs)
      .catch(() => setOrgs(null));
  }, [accessToken, canViewOrgs]);

  useEffect(refresh, [refresh]);
  // Read after mount (SSR has no localStorage), then follow every switch.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setCurrent(getCurrentOrg());
    return subscribeCurrentOrg(() => setCurrent(getCurrentOrg()));
  }, []);

  function switchTo(key: string) {
    setCurrentOrg(key);
    navigate("/dashboard");
  }

  const items: UserMenuEntry[] = [];
  if (canViewOrgs && orgs) {
    // Same fallback as the dashboard: an unknown/unset pick shows the first org.
    const known = current === PERSONAL_ORG || orgs.some((org) => org.id === current);
    const active = known ? current : (orgs[0]?.id ?? PERSONAL_ORG);
    items.push(
      { header: "Switch organization" },
      ...orgs.map((org) => ({ label: org.name, onClick: () => switchTo(org.id), active: org.id === active })),
      { label: "Personal (no organization)", onClick: () => switchTo(PERSONAL_ORG), active: active === PERSONAL_ORG },
      { divider: true },
      { label: "Manage organizations", to: "/platform-org/orgs" },
    );
  }
  return { items, refresh };
}
