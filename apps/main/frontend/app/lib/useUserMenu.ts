import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { defineMessages, LOCALE_NAMES, LOCALES, useLocale, useT, type UserMenuEntry } from "platform-core";
import { hasPermission, setUserLanguage } from "platform-auth-frontend";
import { fetchOrgs, getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg, type OrgOption } from "goalnexa-frontend";
import { consoleHome } from "./systemNav";

/**
 * The header's user dropdown (above "Log out"): switch organization - the
 * org the dashboard, check-in table and team board show (goalnexa's
 * current org; they have no org picker of their own), so picking one
 * keeps those pages and opens the dashboard from anywhere else - then "Manage organizations" (platform-org's list,
 * where an org's page manages members and invitations). The org list is
 * refreshed each time the menu opens (`refresh`), so an org created or
 * joined since shows up. Without `orgs.view` the org section is left out.
 * Then "My account", "Email preferences", and for admins "System
 * console" (system-shell.tsx), and last the language (each in its own
 * name; saved on the account - platform-auth's `setUserLanguage`).
 */
const messages = defineMessages({
  en: {
    switchOrg: "Switch organization",
    personal: "Personal (no organization)",
    manageOrgs: "Manage organizations",
    account: "My account",
    emailPrefs: "Email preferences",
    console: "System console",
    language: "Language",
  },
  vi: {
    switchOrg: "Chuyển tổ chức",
    personal: "Cá nhân (không thuộc tổ chức)",
    manageOrgs: "Quản lý tổ chức",
    account: "Tài khoản của tôi",
    emailPrefs: "Tùy chọn email",
    console: "Bảng quản trị hệ thống",
    language: "Ngôn ngữ",
  },
});

/** Pages that follow the current org live - switching stays on them. */
const ORG_PAGES = ["/dashboard", "/table", "/board"];

export function useUserMenu(accessToken: string | null, permissions: string[] | null) {
  const t = useT(messages);
  const locale = useLocale();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
    if (!ORG_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) navigate("/dashboard");
  }

  const items: UserMenuEntry[] = [];
  if (canViewOrgs && orgs) {
    // Same fallback as the dashboard: an unknown/unset pick shows the first org.
    const known = current === PERSONAL_ORG || orgs.some((org) => org.id === current);
    const active = known ? current : (orgs[0]?.id ?? PERSONAL_ORG);
    items.push(
      { header: t("switchOrg") },
      ...orgs.map((org) => ({ label: org.name, onClick: () => switchTo(org.id), active: org.id === active })),
      { label: t("personal"), onClick: () => switchTo(PERSONAL_ORG), active: active === PERSONAL_ORG },
      { divider: true },
      { label: t("manageOrgs"), to: "/platform-org/orgs" },
    );
  }
  // Everyone's own account page: download my data, delete my account.
  items.push(
    ...(items.length ? [{ divider: true as const }] : []),
    { label: t("account"), to: "/account" },
    // What we email them about (platform-core's preferences page).
    { label: t("emailPrefs"), to: "/email/preferences" },
  );
  const consolePath = consoleHome(permissions);
  if (consolePath) items.push({ label: t("console"), to: consolePath });
  items.push(
    { divider: true },
    { header: t("language") },
    ...LOCALES.map((code) => ({
      label: LOCALE_NAMES[code],
      // A failed save leaves this browser switched; the account keeps its old pick.
      onClick: () => void setUserLanguage(code).catch(() => undefined),
      active: code === locale,
    })),
  );
  return { items, refresh };
}
