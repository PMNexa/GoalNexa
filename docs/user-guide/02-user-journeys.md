# GoalNexa user journeys

End-to-end journeys, from the first visit to a routine. Each stage lists
what the user does, where (screen), and what they should feel or know at
the end. Use cases are in [01-use-cases.md](01-use-cases.md).

## J1. Solo goal-setter: "I want to run a half marathon"

| Stage | User does | Screen | Outcome |
|---|---|---|---|
| Discover | Opens the site, clicks **Sign up**. | Sign up | Account created. |
| Start | Wizard: *Use the website* → skips the organization → goal "Run a half marathon", target date → metrics "Weekly distance 10 → 40 km", "Longest run 5 → 21 km" → **Create**. | Onboarding wizard | Dashboard shows the goal at 0%. |
| Plan rhythm | Opens the metric, sets **Check in every: weekly**. Goes to **Reminders**, adds a Telegram URL, **Send a test**. | Metric drawer, Reminders | Knows they'll be nudged. |
| Routine | After each run: dashboard → metric **+ > Check in** → value. Or when the clock icon appears. | Dashboard, Check-in modal | Line moves up, prediction updates. |
| Review | Sunday: reads the health badge and "→ 85% by Nov 8". | Dashboard | Knows whether to push harder. |
| Finish | Goal hits 100% → **Achieved**. Archives it from the goal's edit form. | Goal detail | Goal leaves the tree. |

**Pain points addressed:** no spreadsheet, progress and pace computed
automatically, reminders only when a check-in is actually due.

## J2. Team lead: quarterly OKRs for a small team

| Stage | User does | Screen | Outcome |
|---|---|---|---|
| Set up | Creates organization "Northwind Studio", invites 3 people, copies each invitation link. | Organizations | Team joins. |
| Quarter | Creates cycle "Q4 2026" (Oct 1 - Dec 31). | Cycles | A period to plan in. |
| Plan | Dashboard → cycle Q4 2026 → **New goal** x3, metrics for each. Some goals **Private** with chosen members. | Dashboard, Goal drawer | OKRs in place. |
| Weekly | Monday: **Check-in table** → types the week's numbers for all metrics → **Save**. Team members check in from the dashboard or their assistant. | Check-in table | One update for everything. |
| Follow | Reads the **Goals digest** in email; opens goals flagged *At risk*; comments in **Activity**. | Email, Goal page | Problems surface early. |
| Report | **Share** → link for the leadership's dashboard. | Share modal | Stakeholders see live charts. |
| Close | Opens the cycle → **Close this cycle**: scores, done / dropped / roll over into Q1. | Cycle page | Scorecard; unfinished goals continue. |

## J3. Org admin: one sales system, many teams

| Stage | User does | Screen | Outcome |
|---|---|---|---|
| Structure | Creates teams Sales > North, South, and Support; adds leads and members. | Teams | Org tree. |
| Template | Creates template "Quarterly sales targets": goal "Grow revenue" (Revenue $, Deals closed) with sub-goal "Build pipeline" (Demos booked, 10 per week). Picks how each metric totals (sum, average...). | Goal templates | One shape for every team. |
| Apply | **Team board** → template + cycle → **Add** for North and South. | Team board | Each team gets its own goals. |
| Targets | **Targets** mode → per-team targets; the board shows the gap against the planned total. | Team board | Targets agreed. |
| Weekly | Each lead enters their team's numbers in **Check in** mode → **Save check-ins**; **Show by** week to compare periods; **Full screen** for the Monday meeting. | Team board | Totals per branch and whole org update. |
| Change | Edits the template (adds a metric) → every team's copy updates. | Goal templates | No drift between teams. |

## J4. Chat-first user: "I never open the website"

| Stage | User does | Screen / channel | Outcome |
|---|---|---|---|
| Sign up | Signs up on the web; wizard → *Use an AI agent*. | Onboarding wizard | — |
| Connect | Picks the client (e.g. Claude), follows the steps; the wizard shows **Connected**. | MCP connect guide | Assistant has access. |
| Skills | Copies "Install the goalnexa skills from ..." into the assistant. | Assistant chat | Assistant knows how to plan, check in, review. |
| Plan | "Help me plan reading 24 books this year." → the assistant drafts, asks, creates. | Chat | Goal + metric created. |
| Check in | "Finished another book." → assistant logs it, replies with progress and a dashboard link. | Chat | Check-in marked *agent*. |
| Review | "How are my goals doing?" weekly. | Chat | Pace and risks in one answer. |

## J5. Stakeholder with a link

| Stage | User does | Screen | Outcome |
|---|---|---|---|
| Receive | Gets a `/shared/...` link from a team lead. | — | — |
| View | Opens it: charts and the goal tree, no login. Hides/shows goals for this visit. | Shared dashboard | Sees live progress. |
| Lose access | The lead revokes the link, or leaves the org. | — | Link stops showing those goals. |

## J6. Administrator: run the instance

| Stage | User does | Screen | Outcome |
|---|---|---|---|
| Install | Starts GoalNexa, opens it, completes **First-run setup**. | Setup | Admin account. |
| Configure | **System console > Settings**: signup policy, allowed domains, limits, announcement. Configures email in `.env`. | Settings | Instance fits the company. |
| Onboard | Invites users from **Users**, or lets them sign up. | Users | People arrive. |
| Operate | Checks **Status** (scheduler running, email delivered), **Audit** log, **Insights**. | Status, Audit, Insights | Healthy instance. |
| Support | Unlocks an account, sends a password link, **View as** a user to see their problem. | User page | Issue solved without passwords. |
