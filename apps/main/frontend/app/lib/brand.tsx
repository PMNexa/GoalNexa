import { Link } from "react-router";

/** The app icon: a progress ring around a target (same as the marketing site's). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="gn-logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#206bc4" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r="17"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="80 107"
        transform="rotate(-90 32 32)"
      />
      <circle cx="32" cy="32" r="6.5" fill="#fff" />
    </svg>
  );
}

/**
 * Logo + name above the login/signup/reset cards (platform-auth's
 * `AuthScreenProvider` title), linking home: `/` is the landing page
 * where an extension provides one, else the dashboard.
 */
export function BrandHome() {
  return (
    <Link to="/" className="gn-brand-home" aria-label="GoalNexa home">
      <LogoMark />
      GoalNexa
    </Link>
  );
}
