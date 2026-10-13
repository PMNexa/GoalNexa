# GoalNexa use cases

Who uses GoalNexa, and what they come to do. Each use case names the
actor, the goal, the trigger, the main flow and the result. The screens
mentioned are described in [03-functions-by-screen.md](03-functions-by-screen.md);
the step-by-step instructions are in the [user manual](manual/GoalNexa-User-Manual.md).

## Actors

| Actor | Who | Typical device |
|---|---|---|
| **Individual** | Tracks personal goals and habits (running, reading, saving). | Phone + laptop |
| **Team member** | Belongs to an organization; checks in on shared goals. | Laptop, chat assistant |
| **Team lead / manager** | Owns an organization's or a team's goals; sets targets, reviews progress, runs the quarterly rhythm. | Laptop |
| **Org owner / admin** | Manages an organization: members, invitations, teams, goal templates. | Laptop |
| **AI-agent user** | Sets up once on the web, then plans, checks in and reviews by chatting with an assistant (Claude, ChatGPT, Cursor...) over MCP. | Phone, chat app |
| **Viewer (public link)** | Someone without an account who opens a shared dashboard link. | Any browser |
| **System administrator** | Runs the GoalNexa instance: users, roles, settings, email, status. | Laptop |

## Use case list

| ID | Use case | Primary actor |
|---|---|---|
| UC-01 | Install and create the first (admin) account | System administrator |
| UC-02 | Sign up, sign in, reset a forgotten password | Everyone |
| UC-03 | Get started with the onboarding wizard | Individual, team lead |
| UC-04 | Create a goal with measurable metrics | Individual, team lead |
| UC-05 | Check in progress on a metric | Individual, team member |
| UC-06 | See progress, prediction and health on the dashboard | Everyone with an account |
| UC-07 | Check in many metrics at once (check-in table) | Team member, team lead |
| UC-08 | Get reminders and a goals digest | Individual, team lead |
| UC-09 | Create an organization and invite members | Org owner |
| UC-10 | Share a goal privately with chosen people | Goal owner |
| UC-11 | Share a read-only dashboard link | Team lead |
| UC-12 | Run quarterly cycles and score goals | Team lead |
| UC-13 | Run one goal system across several teams (templates + team board) | Org owner / admin, team lead |
| UC-14 | Set targets per period (daily, weekly, monthly quotas) | Individual, team lead |
| UC-15 | Feed a metric automatically (ingest URL) | Technical user |
| UC-16 | Work with an AI assistant (MCP) | AI-agent user |
| UC-17 | Discuss a goal and follow the activity feed | Team member |
| UC-18 | Manage my account and email preferences | Everyone |
| UC-19 | Administer the instance (system console) | System administrator |

---

### UC-01 Install and create the first account

- **Actor:** system administrator.
- **Trigger:** a fresh GoalNexa install with no users.
- **Flow:** open the site → GoalNexa sends you to **First-run setup** ->
  enter name, email, password → the account is created as **Admin**.
- **Result:** the admin is signed in on the dashboard; roles and
  permissions are already seeded.

### UC-02 Sign up, sign in, reset a password

- **Actor:** anyone.
- **Flow:** **Sign up** (name, email, password) or **Sign in**; **Forgot
  password?** emails a single-use reset link. Single sign-on buttons
  appear when the instance has an OpenID Connect provider.
- **Rules:** the administrator decides whether signup is open, by
  invitation only or closed, and which email domains are allowed. Too
  many wrong passwords lock the account for a while.
- **Result:** the user lands on the dashboard (or on the page they were
  heading to).

### UC-03 Get started with the onboarding wizard

- **Actor:** a new user with no goals.
- **Trigger:** the first visit to the dashboard.
- **Flow:** pick how you will use GoalNexa:
  - **Use the website** → name the organization → list goals (optional
    target date) → add metrics per goal (start → target) → review ->
    **Create and open dashboard**.
  - **Use an AI agent** → connect the assistant → install the skills ->
    copy a starter prompt.
  - **Skip for now** → an empty dashboard.
- **Result:** the dashboard opens on the new goals.

### UC-04 Create a goal with measurable metrics

- **Actor:** individual or team lead.
- **Flow:** dashboard **New goal** (or the Goals page) → title, optional
  organization, cycle, target date, visibility → save → **+ > Add
  metric** → name, unit, start value, target value, how check-ins add
  up (**latest reading** or **sum**), optional schedule.
- **Variants:** sub-goals (**+ > Add sub-goal**), sub-metrics (a metric
  broken into parts), a metric that should go *down* (target below
  start), a *tracked-only* metric (target = start: no %, just values).
- **Result:** the goal appears in the goal tree with a 0% progress bar.

### UC-05 Check in progress

- **Actor:** individual or team member.
- **Flow:** dashboard → metric row **+ > Check in** (or the clock icon
  when a check-in is due) → value, optional note, optional date ->
  **Save**.
- **Rules:** a *latest* metric takes the new reading ("we're at 420");
  a *sum* metric takes the amount done ("ran 12 km"). The check-in date
  can be backdated; progress always uses the latest reading by date.
- **Result:** the charts, progress %, prediction and health update.

### UC-06 See progress on the dashboard

- **Actor:** anyone with goals.
- **Flow:** choose organization (or *Personal goals*), cycle, team ->
  show up to 8 goals → read one chart per goal: each metric's progress
  over time, a *Now* line, the dashed target-date line, a dashed
  *prediction* to the target date, and a health badge (**On track / At
  risk / Off track / Achieved**).
- **Result:** the user knows which goals need attention.

### UC-07 Check in many metrics at once

- **Actor:** team member or lead doing a weekly update.
- **Flow:** **Check-in table** → pick organization and goals → type
  values in the right-hand column → **Save**.
- **Result:** one save records a check-in for every filled cell.

### UC-08 Reminders and the goals digest

- **Actor:** goal owner.
- **Flow:** give metrics a schedule (**Check in every**: daily / weekly /
  monthly) → **Reminders** page → turn on **Send me reminders**, paste
  where they go (email, Telegram, Slack, Discord, ntfy...) → choose a
  **Goals digest** (daily or weekly, day, hour) → **Save**, **Send a
  test**.
- **Result:** one message per due date listing overdue check-ins, plus
  a periodic summary of what moved, what is at risk and what is due.

### UC-09 Create an organization and invite members

- **Actor:** org owner.
- **Flow:** **Organizations > My organizations > + New** → name → on the
  organization's page invite by email → copy the invitation link and
  send it → the invitee signs up or signs in with that email and
  accepts.
- **Result:** members see the organization's public goals; owners and
  admins manage members, roles and teams.

### UC-10 Share a goal privately

- **Actor:** goal owner.
- **Flow:** open the goal (name in the tree, or Goals page) → **Sharing** panel
  → set visibility **Private** → add members of the organization.
- **Result:** only the owner and the listed members see the goal, its
  metrics and check-ins.

### UC-11 Share a read-only dashboard link

- **Actor:** team lead.
- **Flow:** dashboard → **Share** → create a link for the shown goals ->
  copy it → anyone with the link sees the charts, without signing in.
- **Rules:** the link is live and only shows what its creator can still
  see. **Revoke** ends it.

### UC-12 Quarterly cycles and scoring

- **Actor:** team lead.
- **Flow:** **Cycles > New** (name, start, end) → goals join the cycle
  → dashboard cycle filter during the quarter → at the end open the
  cycle → **Close this cycle**: give each goal a score (0-1, defaults to its
  progress) and choose *done*, *dropped* or *roll over* into the next
  cycle.
- **Result:** a scorecard per goal (achieved >= 0.7, partial >= 0.3,
  missed, dropped); rolled-over goals continue in the next cycle.

### UC-13 One goal system across several teams

- **Actor:** org owner/admin (setup), team leads and members (use).
- **Flow:** create **Teams** → create a **Goal template** (goals and
  metrics, how team numbers roll up) → **Team board** → pick template
  and cycle → **Add** the template for each team → **Targets** mode to
  set each team's targets → **Check in** mode to enter each team's
  numbers → **Save check-ins**.
- **Result:** every team has its own copy of the goals; totals per team
  branch and for the whole organization are calculated automatically.

### UC-14 Targets per period (quotas)

- **Actor:** individual or team lead.
- **Flow:** a *sum* metric with **Target per** (day / week / month /
  quarter / year), counting all days or weekdays only → check in
  amounts → the dashboard shows a per-period bar chart, the hit rate
  and the streak.
- **Result:** progress is measured against the quota so far, not the
  final total; reminders nudge near the end of a period if short.

### UC-15 Feed a metric automatically

- **Actor:** technical user (a script, Zapier, a spreadsheet).
- **Flow:** open the metric → **Automatic check-ins** → create a token
  → copy the URL → the other system POSTs values to it.
- **Result:** check-ins arrive with source *ingest*, no login needed.

### UC-16 Work with an AI assistant

- **Actor:** AI-agent user.
- **Flow:** **MCP access** page → pick the client (Claude, ChatGPT,
  Cursor, VS Code, Codex, Gemini CLI...) → follow its steps (OAuth or a
  personal access token) → install the GoalNexa skills → chat: "ran
  12 km today", "plan a half marathon in November", "how are my goals
  doing?".
- **Result:** the assistant creates goals, checks in and reviews
  progress with the same permissions as the user; check-ins are marked
  *agent* in the feed.

### UC-17 Comments and activity

- **Actor:** team member.
- **Flow:** open a goal → **Activity** → read who checked in what, write
  a comment.
- **Result:** the team discusses progress next to the numbers.

### UC-18 My account and email preferences

- **Actor:** everyone.
- **Flow:** user menu → **My account**: change password, download my
  data, delete my account. **Email preferences**: turn email categories
  on or off.

### UC-19 Administer the instance

- **Actor:** system administrator.
- **Flow:** user menu → **System console** → status, settings (signup
  policy, limits, announcement...), users (invite, disable, unlock,
  reset password, view as), roles and permissions, all organizations,
  audit log, email logs, lifecycle email, insights.
