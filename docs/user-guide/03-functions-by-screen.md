# GoalNexa functions by screen

Every user-facing screen, what it is for, and the functions it offers.
Labels are the ones the app shows. Function IDs (`F-<screen>-<n>`) are
referenced from the [user manual](manual/GoalNexa-User-Manual.md) and
map back to the [use cases](01-use-cases.md).

Screens:

| # | Screen | Path | Who |
|---|---|---|---|
| S0 | App shell (sidebar, user menu) | every signed-in page | Signed in |
| S1 | Sign in / Sign up / Setup / Password | `/auth/*` | Everyone |
| S2 | Onboarding wizard | inside `/dashboard` | New users |
| S3 | Dashboard | `/dashboard` | Signed in |
| S4 | Shared dashboard | `/shared/<token>` | Anyone with the link |
| S5 | Check-in table | `/table` | Signed in |
| S6 | Team board | `/board` | Org members (`goal-templates.view`) |
| S7 | Lists, detail and edit pages | `/goals`, `/metrics`, `/check-ins`, `/cycles`, `/goal-templates`, `/platform-org/orgs`, `/platform-org/teams` | Signed in |
| S8 | Goal page | `/goals/<id>` (and dashboard drawer) | Signed in |
| S9 | Metric page | `/metrics/<id>` (and dashboard drawer) | Signed in |
| S10 | Cycle page | `/cycles/<id>` | Signed in |
| S11 | Goal template page | `/goal-templates/<id>` | Org owners/admins edit |
| S12 | Organizations, teams, invitations | `/platform-org/*` | Signed in |
| S13 | Reminders | `/reminders` | Signed in |
| S14 | MCP access | `/mcp`, `/mcp/authorize` | Signed in |
| S15 | My account | `/account` | Signed in |
| S16 | Email preferences / unsubscribe | `/email/*` | Signed in / anyone |
| S17 | System console | `/system/*` | Administrators |

---

## S0 App shell

| ID | Function | Details |
|---|---|---|
| F-S0-1 | Sidebar navigation | **Dashboard**, **Check-in table**, **Team board**; group **Goal tracking** (Goals, Cycles, Goal templates, Metrics, Check-ins, Reminders); group **Organizations** (My organizations, Teams, Invitations); **MCP access**. Groups collapse and stay collapsed. Links the user has no permission for are hidden. |
| F-S0-2 | Collapse sidebar | The icon left of the header hides/shows the sidebar. |
| F-S0-3 | User menu | Avatar (top right): name and email, **Switch organization** (each org, *Personal (no organization)*; opens the dashboard on it), **Manage organizations**, **My account**, **Email preferences**, **System console** (administrators only), **Log out**. |
| F-S0-4 | Announcement banner | A message set by the administrator; **Dismiss** (×) hides it in this browser. |
| F-S0-5 | View-as banner | While an administrator views as a user: "Viewing as ... read-only, ends in 15 minutes", **Stop viewing**. |

## S1 Sign in, sign up, setup, password

| ID | Function | Details |
|---|---|---|
| F-S1-1 | Sign in (`/auth/login`) | **Email**, **Password**, **Sign In**. "No account yet? **Sign up**". |
| F-S1-2 | Single sign-on | **Continue with \<provider\>** buttons when the instance has one; a password-less instance hides the form. |
| F-S1-3 | Sign up (`/auth/signup`) | **Name**, **Email**, **Password** (at least 8 characters by default), **Sign Up**. Email is prefilled from an invitation link. |
| F-S1-4 | Confirm email | When the instance requires it: "We sent a link to \<email\>... works for 7 days", **Send it again**. The link (`/auth/verify`) confirms and signs in. |
| F-S1-5 | First-run setup (`/auth/setup`) | Only on a fresh install: "Welcome - let's set things up", **Create admin account**. |
| F-S1-6 | Forgot password (`/auth/forgot`) | **Email**, **Email me a link**; the link works for 2 hours. |
| F-S1-7 | Reset password (`/auth/reset`) | **New password**, **Repeat it**, **Save password and sign in**. Also used by an administrator's invitation / password link. |
| F-S1-8 | Account lockout | Too many wrong passwords lock the account for a while; an administrator can unlock it. |

## S2 Onboarding wizard

Shown on the dashboard to a user with no organization and no goals (or
for an organization with no goals yet: "Set up \<org\>").

| ID | Function | Details |
|---|---|---|
| F-S2-1 | Choose a start | "How do you want to use GoalNexa?": **Use an AI agent** (Recommended) or **Use the website**. |
| F-S2-2 | Skip | **Skip for now** - not asked again in this browser. |
| F-S2-3 | Website: organization | **Organization name** (skipped for an existing org). |
| F-S2-4 | Website: goals | **Goal**, **Target date** (optional), description; **+ Add goal**. |
| F-S2-5 | Website: metrics | Per goal: metric name, unit, start, target (must differ), description; **+ Add metric**. |
| F-S2-6 | Website: review and create | Summary, **Create and open dashboard**. A failed create can be retried without duplicates. |
| F-S2-7 | AI agent: connect | Pick the app (Claude, ChatGPT, Cursor...), follow its steps; shows **Connected** when it reaches the server. |
| F-S2-8 | AI agent: skills | Copy "Install the goalnexa skills from ...". |
| F-S2-9 | AI agent: try it | Copy a starter prompt (plan / check in / review); **Done - open dashboard**. |

## S3 Dashboard

| ID | Function | Details |
|---|---|---|
| F-S3-1 | Organization filter | **Organization**: each org or *Personal (no organization)*; follows the user menu's switch; remembered. |
| F-S3-2 | Cycle filter | **Cycle** (if the org has cycles): All goals, each cycle (closed/planning marked), Not in a cycle. Opens on today's cycle. |
| F-S3-3 | Show check-ins by | As logged, Day, Week, Month, Quarter, Year - lines keep the last reading per period; amounts also show as bars. |
| F-S3-4 | Team filter | **Team** (if the org has teams): All goals or one team (with its sub-teams). |
| F-S3-5 | Goal tree | Each goal: color key, title, % pill, progress bar, **+** menu, eye. Under it: its metrics (value / target), then sub-goals. Archived goals are not listed. |
| F-S3-6 | Show / hide | Eye on a goal (up to 8 shown, **Show all** / **Show first 8**, **Hide all**); eye on a metric leaves it out of that goal's progress. |
| F-S3-7 | New goal | **New goal** in the Goals header (presets org, cycle). |
| F-S3-8 | Goal **+** menu | **Add metric**, **Add sub-goal**. |
| F-S3-9 | Metric **+** menu | **Check in**, **Add sub-metric**. |
| F-S3-10 | Check-in modal | "Check in: \<metric\>": **Value** (or **Amount to add** for a sum metric), **When** (blank = now; or **For** a period), **Note**, **Save check-in**. |
| F-S3-11 | Due clock | Shown after a metric's name when its scheduled check-in is overdue; opens the check-in modal. |
| F-S3-12 | Drawer | Clicking a goal or metric name opens its page in a right-hand drawer (details, Edit, Delete, tabs; for a goal **Sharing** and **Activity**; for a metric **Automatic check-ins**). Closing refreshes the charts. |
| F-S3-13 | Reorder | Drag a row within its siblings; the order is saved. |
| F-S3-14 | Progress charts | One card per shown goal: title, %, projection "→ N% by \<date\>", health badge (**On track**, **At risk**, **Off track**, **Achieved**, or **Tracking**); lines per metric with **Now** and **Target \<date\>** markers and a dashed prediction; hover for each reading. |
| F-S3-15 | Tracked and per-period charts | "Tracked, no target" value charts; "Per period" bars against the quota. |
| F-S3-16 | Current progress | A bar per shown goal. |
| F-S3-17 | Share | **Share** → "Share dashboard": **Name**, **Create link**, Copy; **Your links** with Copy and **Revoke**. |
| F-S3-18 | Deep link | `/dashboard?goal=<id>` opens that goal alone (used by reminders and assistants). |

**Health rules:** Achieved = at 100%; past the target date and not
achieved = Off track; otherwise from the projection to the target date:
>= 100% On track, >= 80% At risk, below Off track. No target date or no
data = no badge.

## S4 Shared dashboard (`/shared/<token>`)

| ID | Function | Details |
|---|---|---|
| F-S4-1 | View | The link's name, "Read-only · shared from GoalNexa", the goal tree and the same charts as the dashboard. No sign-in. |
| F-S4-2 | Show / hide | Eyes work for this visit only; no menus, check-ins or drawers. |
| F-S4-3 | Revoked link | "This link was removed, or it never existed." |

## S5 Check-in table (`/table`)

| ID | Function | Details |
|---|---|---|
| F-S5-1 | Organization | Same switch as the dashboard. |
| F-S5-2 | Goals picker | Tick goals (sub-goals follow); none = all; remembered per org. |
| F-S5-3 | New goal | Opens the goal form. |
| F-S5-4 | Snap to | Hour / Day / Week (with **Week starts on**) / Month: one column per period. |
| F-S5-5 | Read history | Rows: goals, sub-goals, metrics; **Target** column (start → target, or *tracked*); one column per period with value, the amount added or %, notes on hover. |
| F-S5-6 | Bulk check-in | Right-hand column: pick the period/date, type values per metric (Enter saves), **Save N**. |
| F-S5-7 | Row menus | **+**: goal → Add metric / Add sub-goal; metric → Check in / Add sub-metric. |
| F-S5-8 | Reorder, collapse | Drag a row's name within its siblings; collapse rows. |

## S6 Team board (`/board`)

| ID | Function | Details |
|---|---|---|
| F-S6-1 | Pick | **Organization**, **Goal template** (**+ New**), **Cycle**, **Teams** (all or one subtree). |
| F-S6-2 | Mode | **Check in** or **Targets**. |
| F-S6-3 | Check in | Each team's cell: current / target, %, pace "≈ N/week to go"; type an amount or value, **✎** adds a note; **Checked in at** sets the time (running totals only); **Save N check-ins**; **Discard**. |
| F-S6-4 | Show by | One picker: its tabs are Totals (running totals, with **Checked in at** beside it), Day, Week, Month, Quarter, Year; with a period kind, click the period. The board shows that period's numbers, and saved check-ins go to it. |
| F-S6-5 | Totals | Rows *Whole organization* and each department: calculated from the teams, read-only; planned target and gap. |
| F-S6-6 | Last update | Per goal: when each team last checked in; for totals, "x/y teams". |
| F-S6-7 | Targets | **Start** and **Target** per team and metric, **Planned** target on totals; **Save targets**. |
| F-S6-8 | Add the template to teams | **Add** next to "Doesn't use this template in this cycle.", or tick teams in Targets mode → **Add to N teams**. |
| F-S6-9 | Edit the template | Click a goal or metric header to edit it in a drawer; **✕** removes it from the template (copies with check-ins are kept as the team's own). "Edit the template" link. |
| F-S6-10 | Template wizard | **+ New** / **Create the first one**: Template → Goals → Metrics (each check-in is, totals, target is for, counts, progress is, which check-ins count, check-ins are for, start, default target) → Teams → Review → **Create the template**. |
| F-S6-11 | Full screen | **Full screen** / **Exit full screen** (Esc). |

## S7 Lists, detail and edit pages

Generic pages used by Goals, Metrics, Check-ins, Cycles, Goal templates,
Organizations and Teams.

| ID | Function | Details |
|---|---|---|
| F-S7-1 | List | Table, pagination, page size; click a row to open it. |
| F-S7-2 | Create | **+ New \<item\>** → form with hints under each field → **Create**. |
| F-S7-3 | Search | **Search…** box (where offered). |
| F-S7-4 | Filter | **Filter** → **+ Add filter…** → field, operator (contains, is, =, >, before, after, is empty...), value → **Apply**; chips with ×, **Clear**. |
| F-S7-5 | Columns | Show/hide and reorder columns. |
| F-S7-6 | Row actions | View, Edit, Delete ("Delete this item?"). |
| F-S7-7 | Detail page | Breadcrumb, **Edit** (in place, **Save**), **Delete**, **Details** tab, one tab per related list (a goal's Metrics and Sub goals, a metric's Check-ins, a cycle's Goals...). |
| F-S7-8 | Related lists | Search, **New \<item\>** (parent preset), edit in a modal, delete; **Link existing** / **Unlink** for many-to-many. |

## S8 Goal page

Generic detail page plus:

| ID | Function | Details |
|---|---|---|
| F-S8-1 | Goal fields | Title, Description, Organization, Status (Not started / In progress / Completed / Archived), Target date, Visibility, Team, Cycle, Parent; read-only Progress, Projected progress, Health. |
| F-S8-2 | Visibility | **Sharing** panel (owner only): **Public** (everyone in the org), **Private** (owner + members), **Team only** (a team goal). |
| F-S8-3 | Goal members | **Add a member of \<org\>…** → **Add**; **Remove** (owner) / **Leave** (self). |
| F-S8-4 | Comments | **Activity** panel: "Write a comment…", **Comment**; delete your own. |
| F-S8-5 | Activity feed | Goal created, fields changed, metrics added/removed, check-ins (marked *AI agent* when one did it), health changes, cycle scores. |

## S9 Metric page

| ID | Function | Details |
|---|---|---|
| F-S9-1 | Metric fields | Name, Description, Unit, Start (base) value, Target value, Current value, Each check-in is (new value / amount to add), Check in every (no schedule / daily / weekly / monthly), Target is for (whole goal / each day...year), Counts (every day / weekdays), Progress is (total / how often hit), One reading per, Check-ins are for, Parent. |
| F-S9-2 | Check-ins | **Check ins** tab: list, add, edit, delete. |
| F-S9-3 | Automatic check-ins | **Create token** / **Rotate token**, copy the URL and `curl` example (token shown once), **Revoke**. |

## S10 Cycle page

| ID | Function | Details |
|---|---|---|
| F-S10-1 | Cycle fields | Name, Organization, Starts on, Ends on, Status (Planning / Active / Closed), Retro. Goals tab. |
| F-S10-2 | Close a cycle | Per goal: **Score** (0-1, prefilled from progress), **Then** (Done / Roll over / Drop), **Reflection**; **Roll over into** (or **Create "\<next\>"**); **Retro**; **Close cycle and score N goals**. Cannot be undone. |
| F-S10-3 | Scorecard | Closed cycle: average score, Achieved (>= 0.7) / Partial (>= 0.3) / Missed / Dropped counts, per-goal table. |

## S11 Goal template page

| ID | Function | Details |
|---|---|---|
| F-S11-1 | Template | Name, description, organization; tabs for its goals (and each goal's metrics). Owners/admins only change it; every team's copy follows. |
| F-S11-2 | Template metric rules | Totals: Sum / Average / Lowest / Not rolled up; default start and target (empty = each team sets its own). |
| F-S11-3 | Open the team board | Button to the board on this template. |

## S12 Organizations, teams, invitations

| ID | Function | Details |
|---|---|---|
| F-S12-1 | Organizations | **My organizations** list; **New**: name, time zone. |
| F-S12-2 | Members | Organization page → **Members**: role (Owner / Admin / Member), **Leave**, **Remove**. |
| F-S12-3 | Invite | **Invite member** → **Email**, **Role** → **Create invitation** → **Copy link** (no email is sent; the link expires). **Pending invitations**: Copy link, **Revoke**. |
| F-S12-4 | Accept an invitation | The link → sign up / sign in with that email → "Join \<org\>" → **Accept invitation** / **Decline**. Or **Invitations** page: **Accept** / **Decline**. |
| F-S12-5 | Teams | **Teams** list, **New**: name, organization, parent team. Team page → **Team members**: add from the org as **Lead** or **Member**, **Remove**, **Leave**. |

## S13 Reminders (`/reminders`)

| ID | Function | Details |
|---|---|---|
| F-S13-1 | Check-in reminders | **Send me reminders**; **Email them to my account address** (if the instance sends email); **Send to**: one Apprise URL per line (Telegram, Slack, Discord, ntfy, email...). |
| F-S13-2 | Goals digest | Weekly / Daily / Off, weekday, hour (your browser's time zone). |
| F-S13-3 | Save / test | **Save**, **Send a test** (after saving). |
| F-S13-4 | Due now | Metrics whose check-in is overdue. |
| F-S13-5 | URL examples | Ready-made URL formats. |

## S14 MCP access (`/mcp`)

| ID | Function | Details |
|---|---|---|
| F-S14-1 | Connect guide | **Which app do you use?** (Claude, ChatGPT, Gemini, Cursor, VS Code, Windsurf, Claude Code, Codex CLI, Gemini CLI, Claude Desktop, Other) → its steps, URL/snippet, **Create a token**; waits until **Connected**. |
| F-S14-2 | Server URL | Copy the MCP server URL. |
| F-S14-3 | Personal access tokens | **New token** (name, expires after 30 / 90 days / 1 year / never) → copy once; list; **Revoke**. |
| F-S14-4 | Connected apps | Apps signed in with OAuth; **Disconnect**. |
| F-S14-5 | Agent skills | Copy "Install the goalnexa skills from ...". |
| F-S14-6 | Authorize an app | `/mcp/authorize`: "Connect \<client\> to GoalNexa?", **Allow** / **Cancel**. |

## S15 My account (`/account`)

| ID | Function | Details |
|---|---|---|
| F-S15-1 | Download my data | JSON file of everything held about you. |
| F-S15-2 | Change password | Current, new, repeat → **Change password** (signs out other sessions). |
| F-S15-3 | Delete my account | Password + "I understand this can't be undone." → **Delete my account**. |

## S16 Email preferences and unsubscribe

| ID | Function | Details |
|---|---|---|
| F-S16-1 | Preferences | One switch per category: **Reminders & digest**, **Tips & getting started**, **Progress & milestones**. Saves at once. Account emails are always sent. |
| F-S16-2 | Unsubscribe link | From an email: unsubscribe from that category or **Unsubscribe from all**. |

## S17 System console (administrators)

| ID | Page | Main functions |
|---|---|---|
| F-S17-1 | Status | Background jobs (state, last run, failures), deliveries in 24 h, usage numbers. |
| F-S17-2 | Insights | Activity, activation and adoption numbers over N days; **Export CSV**. |
| F-S17-3 | Settings | Grouped settings (signup policy, allowed domains, email verification, password rules, lockout, limits, announcement, data retention...); **Save** / **Reset to default**; "Set by \<ENV\>" = locked; **Test email**; audit export. |
| F-S17-4 | Audit log | Sign-ins, failures, user/role/settings/org changes, impersonation. |
| F-S17-5 | Email log, notification log, suppressed addresses | What was sent, delivered or blocked. |
| F-S17-6 | Lifecycle email | Journeys and step stats; preview, send a test. |
| F-S17-7 | All organizations | Members, transfer owner, per-org limits, delete. |
| F-S17-8 | Users | **Invite user**; per user: disable / enable, **Unlock**, **Create password link**, **View as**, export data, sessions + **Sign out everywhere**, delete. |
| F-S17-9 | Roles, role assignments, permissions | Role-based access control, app-wide or per organization. |
