"""System > Insights sections that join several modules' data - which only
the host may do (a module never imports another's models): the
activation funnel, retention cohorts and people/orgs gone quiet, and
feature adoption. Registered by `config.apps.HostConfig`. Each section is
computed live for the range the admin picked; aggregates only."""

from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone

from django.db.models import Count, Max, Min, Q
from django.utils import timezone

from core_api.system import InsightSection, org_limit, register_insight_section
from goalnexa.models import (
    Activity,
    CheckIn,
    CheckInSource,
    Cycle,
    DashboardShare,
    DigestFrequency,
    Goal,
    GoalComment,
    GoalScore,
    GoalStatus,
    Metric,
    OnboardingChoice,
    ReminderSettings,
)
from platform_auth.models import User
from platform_auth.models.sso import SsoIdentity
from platform_mcp.models import OAuthClient
from platform_org.models import Organization, OrgMembership
from platform_system.models import AuditEvent, DeliveryAttempt, OutgoingEmail, UserDay, UserPresence

QUIET_DAYS = (14, 30)


def _since(days: int) -> datetime:
    start = timezone.now().date() - timedelta(days=days - 1)
    return datetime.combine(start, datetime.min.time(), tzinfo=dt_timezone.utc)


def _pct(part, whole) -> str:
    return "—" if not whole else f"{100 * part / whole:.0f}%"


def _cell(part, whole, *, hint: str = "") -> dict:
    return {"text": _pct(part, whole), "bar": part / whole if whole else 0, **({"hint": hint} if hint else {})}


def _duration(delta: timedelta | None) -> str:
    if delta is None:
        return "—"
    hours = delta.total_seconds() / 3600
    if hours < 1:
        return f"{max(1, round(hours * 60))} min"
    if hours < 48:
        return f"{hours:.0f} h"
    return f"{hours / 24:.0f} days"


def _median(values: list[timedelta]) -> timedelta | None:
    return timedelta(seconds=statistics.median(v.total_seconds() for v in values)) if values else None


def _user_names(ids) -> dict[str, str]:
    return {str(u.id): u.name or u.email for u in User.objects.filter(id__in=list(ids))}


def _active_days_by_user(since: date) -> dict[str, set[date]]:
    """Days each user was active: `UserDay` (sign-ins, refreshes, MCP) plus
    check-ins they wrote - which also covers the time before `UserDay` existed."""
    days: dict[str, set[date]] = defaultdict(set)
    for user_id, day in UserDay.objects.filter(date__gte=since).values_list("user_id", "date"):
        days[user_id].add(day)
    for author_id, created in CheckIn.objects.filter(created_at__date__gte=since).exclude(author_id=None).values_list(
        "author_id", "created_at"
    ):
        days[str(author_id)].add(created.date())
    return days


# --- signup source ----------------------------------------------------------


def signup_sources(user_ids) -> dict[str, str]:
    """Where each account came from, from its `auth.signup` audit event
    (C-17): an assistant's connect flow, a `?ref=` link, single sign-on, or
    the website. Accounts an admin invited, or older than the audit log
    keeps, are "Invited" / "Unknown"."""
    user_ids = [str(u) for u in user_ids]
    clients = dict(OAuthClient.objects.values_list("client_id", "name"))
    sources = {}
    for target_id, data in AuditEvent.objects.filter(action="auth.signup", target_id__in=user_ids).values_list(
        "target_id", "data"
    ):
        data = data or {}
        if data.get("client_id"):
            sources[target_id] = f"Assistant: {clients.get(data['client_id'], 'unknown app')}"
        elif data.get("ref"):
            sources[target_id] = f"Link: {data['ref']}"
        elif data.get("method") == "sso":
            sources[target_id] = "Single sign-on"
        else:
            sources[target_id] = "Website"
    for target_id in AuditEvent.objects.filter(action__in=["user.invited", "auth.setup"], target_id__in=user_ids).values_list(
        "target_id", flat=True
    ):
        sources.setdefault(target_id, "Invited / first account")
    return {u: sources.get(u, "Unknown") for u in user_ids}


# --- P-31: activation funnel -------------------------------------------------

STEPS = ["Signed up", "Confirmed email", "First goal", "First metric", "First check-in", "Checked in in week 2"]


def _milestones(users) -> dict[str, list]:
    """Per user: the time of each step (None = not reached)."""
    ids = [u.id for u in users]
    first_goal = dict(Goal.objects.filter(owner_id__in=ids).values("owner_id").annotate(t=Min("created_at")).values_list("owner_id", "t"))
    first_metric = dict(
        Metric.objects.filter(goal__owner_id__in=ids).values("goal__owner_id").annotate(t=Min("created_at")).values_list("goal__owner_id", "t")
    )
    first_check_in = dict(
        CheckIn.objects.filter(author_id__in=ids).values("author_id").annotate(t=Min("created_at")).values_list("author_id", "t")
    )
    out = {}
    for user in users:
        week_two = (
            CheckIn.objects.filter(
                author_id=user.id,
                created_at__gte=user.created_at + timedelta(days=7),
                created_at__lt=user.created_at + timedelta(days=14),
            )
            .values_list("created_at", flat=True)
            .order_by("created_at")
            .first()
        )
        out[str(user.id)] = [
            user.created_at, user.email_verified_at, first_goal.get(user.id), first_metric.get(user.id),
            first_check_in.get(user.id), week_two,
        ]
    return out


def activation(days: int) -> list[dict]:
    users = list(User.objects.filter(created_at__gte=_since(days)))
    if not users:
        return [{"kind": "tiles", "items": [{"label": "Sign-ups in this range", "value": 0}]}]
    reached = _milestones(users)
    total = len(users)
    # Week 2 can only be judged for accounts at least 14 days old.
    old_enough = {str(u.id) for u in users if timezone.now() - u.created_at >= timedelta(days=14)}
    rows = []
    previous = total
    for step, label in enumerate(STEPS):
        pool = [uid for uid in reached if step < 5 or uid in old_enough]
        got = [uid for uid in pool if reached[uid][step] is not None]
        base = total if step < 5 else len(old_enough)
        times = [reached[uid][step] - reached[uid][0] for uid in got if step > 0]
        rows.append([
            label, len(got), _cell(len(got), base, hint="of accounts 14+ days old" if step == 5 else ""),
            _pct(len(got), previous) if step else "—", _duration(_median(times)) if step else "—",
        ])
        previous = len(got)

    sources = signup_sources(reached)
    choices = {str(k): v for k, v in OnboardingChoice.objects.filter(user_id__in=[u.id for u in users]).values_list("user_id", "choice")}
    choice_labels = dict(OnboardingChoice.Choice.choices)

    def split(group_of) -> list:
        groups: dict[str, list[str]] = defaultdict(list)
        for uid in reached:
            groups[group_of(uid)].append(uid)
        table = []
        for name, members in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            n = len(members)
            table.append([name, n, *[_cell(sum(1 for uid in members if reached[uid][s] is not None), n) for s in range(1, 5)],
                          _cell(sum(1 for uid in members if uid in old_enough and reached[uid][5] is not None),
                                sum(1 for uid in members if uid in old_enough))])
        return table

    split_columns = [{"label": ""}, {"label": "Sign-ups", "align": "end"}, *[{"label": s} for s in STEPS[1:]]]
    return [
        {"kind": "table", "title": f"Accounts created in the last {days} days",
         "columns": [{"label": "Step"}, {"label": "Users", "align": "end"}, {"label": "Of sign-ups"},
                     {"label": "From previous step", "align": "end"}, {"label": "Median time from sign-up", "align": "end"}],
         "rows": rows},
        {"kind": "table", "title": "By where they came from", "columns": [{**split_columns[0], "label": "Source"}, *split_columns[1:]],
         "rows": split(lambda uid: sources[uid])},
        {"kind": "table", "title": "By how they said they'd use it", "columns": [{**split_columns[0], "label": "Onboarding"}, *split_columns[1:]],
         "rows": split(lambda uid: choice_labels.get(choices.get(uid), "Not asked (skipped or had goals)"))},
    ]


# --- P-32: retention cohorts, gone quiet -----------------------------------------


def retention(days: int) -> list[dict]:
    weeks = max(4, min(12, -(-days // 7)))
    today = timezone.now().date()
    this_monday = today - timedelta(days=today.weekday())
    first_monday = this_monday - timedelta(weeks=weeks - 1)
    users = User.objects.filter(created_at__date__gte=first_monday).values_list("id", "created_at")
    active = _active_days_by_user(first_monday)
    cohorts: dict[date, list[str]] = defaultdict(list)
    for user_id, created in users:
        cohorts[created.date() - timedelta(days=created.weekday())].append(str(user_id))
    rows = []
    for i in range(weeks):
        monday = first_monday + timedelta(weeks=i)
        members = cohorts.get(monday, [])
        cells = []
        for week in range(weeks):
            start = monday + timedelta(weeks=week)
            if start > today:
                cells.append("")
                continue
            back = sum(1 for uid in members if any(start <= d < start + timedelta(days=7) for d in active.get(uid, ())))
            cells.append({"text": _pct(back, len(members)), "heat": back / len(members)} if members else "—")
        rows.append([monday.isoformat(), len(members), *cells])

    now = timezone.now()
    last_seen = dict(UserPresence.objects.values_list("user_id", "last_seen_at"))
    for author_id, latest in CheckIn.objects.exclude(author_id=None).values("author_id").annotate(t=Max("created_at")).values_list("author_id", "t"):
        key = str(author_id)
        last_seen[key] = max(filter(None, [last_seen.get(key), latest]))
    quiet = sorted(((uid, t) for uid, t in last_seen.items() if now - t >= timedelta(days=QUIET_DAYS[0])), key=lambda x: x[1], reverse=True)
    names = _user_names(uid for uid, _ in quiet[:50])
    quiet_users = [[names.get(uid, "(deleted)"), t.date().isoformat(), (now - t).days] for uid, t in quiet[:50] if uid in names]

    org_last = dict(
        Activity.objects.exclude(goal__org_id=None).values("goal__org_id").annotate(t=Max("created_at")).values_list("goal__org_id", "t")
    )
    quiet_orgs = []
    orgs = {o.id: o for o in Organization.objects.filter(id__in=list(org_last))}
    for org_id, t in sorted(org_last.items(), key=lambda kv: kv[1], reverse=True):
        if now - t >= timedelta(days=QUIET_DAYS[0]) and org_id in orgs:
            members = OrgMembership.objects.filter(org_id=org_id, status="active").count()
            quiet_orgs.append([orgs[org_id].name, t.date().isoformat(), (now - t).days, members])

    return [
        {"kind": "tiles", "items": [
            {"label": f"Quiet {QUIET_DAYS[0]}-{QUIET_DAYS[1] - 1} days", "value": sum(1 for _, t in quiet if (now - t).days < QUIET_DAYS[1])},
            {"label": f"Quiet {QUIET_DAYS[1]}+ days", "value": sum(1 for _, t in quiet if (now - t).days >= QUIET_DAYS[1])},
            {"label": "Organizations gone quiet", "value": len(quiet_orgs)},
        ]},
        {"kind": "table", "title": "Weekly sign-up cohorts: % active N weeks later", "empty": "No sign-ups in these weeks.",
         "columns": [{"label": "Week of"}, {"label": "Users", "align": "end"}, *[{"label": f"W{w}", "align": "end"} for w in range(weeks)]],
         "rows": rows},
        {"kind": "table", "title": f"People gone quiet ({QUIET_DAYS[0]}+ days, most recent first)", "empty": "Nobody.",
         "columns": [{"label": "User"}, {"label": "Last active"}, {"label": "Days", "align": "end"}], "rows": quiet_users},
        {"kind": "table", "title": f"Organizations gone quiet ({QUIET_DAYS[0]}+ days without goal activity)", "empty": "None.",
         "columns": [{"label": "Organization"}, {"label": "Last activity"}, {"label": "Days", "align": "end"}, {"label": "Members", "align": "end"}],
         "rows": quiet_orgs[:50]},
    ]


# --- P-33: feature adoption, outcomes, top orgs ------------------------------------


def adoption(days: int) -> list[dict]:
    since = _since(days)
    active = set(_active_days_by_user(since.date()))
    n = len(active)
    in_range = Q(created_at__gte=since)
    agent_users = {str(u) for u in UserDay.objects.filter(date__gte=since.date(), agent=True).values_list("user_id", flat=True)}
    agent_users |= {str(u) for u in CheckIn.objects.filter(in_range, source=CheckInSource.AGENT).values_list("author_id", flat=True)}
    settings_rows = {str(r.user_id): r for r in ReminderSettings.objects.all()}

    def uses(ids) -> int:
        return len(active & {str(i) for i in ids if i})

    features = [
        ("Cycles", uses(Goal.objects.exclude(cycle=None).values_list("owner_id", flat=True)) if n else 0,
         "Owns a goal set for a cycle"),
        ("Comments", uses(GoalComment.objects.filter(in_range).values_list("author_id", flat=True)), "Commented in this range"),
        ("Public dashboard links", uses(DashboardShare.objects.values_list("owner_id", flat=True)), "Has a link"),
        ("Automatic check-ins (ingest)", uses(Metric.objects.exclude(ingest_token_hash="").values_list("goal__owner_id", flat=True)),
         "Owns a metric with an ingest token"),
        ("Email digest", sum(1 for uid in active if (settings_rows.get(uid) is None or settings_rows[uid].digest != DigestFrequency.OFF)),
         "Digest on (weekly by default)"),
        ("Reminders", sum(1 for uid in active if uid in settings_rows and settings_rows[uid].enabled and (settings_rows[uid].url_list() or settings_rows[uid].email)),
         "Set up where reminders go"),
        ("AI assistant (MCP)", len(active & agent_users), "Used an assistant in this range"),
        ("Single sign-on", uses(SsoIdentity.objects.values_list("user_id", flat=True)), "Has a linked SSO identity"),
    ]

    goals = Goal.objects.all()
    scores = GoalScore.objects.filter(in_range)
    outcomes = Counter(scores.values_list("outcome", flat=True))
    score_values = [float(s) for s in scores.values_list("score", flat=True) if s is not None]

    # How long after a reminder people check in.
    reminders = list(DeliveryAttempt.objects.filter(in_range, kind="reminder", ok=True).exclude(user_id="").values_list("user_id", "created_at"))
    reminders += list(OutgoingEmail.objects.filter(in_range, kind="reminder").exclude(user_id="").values_list("user_id", "created_at"))
    lags = []
    for user_id, sent in reminders:
        after = CheckIn.objects.filter(author_id=user_id, created_at__gte=sent, created_at__lt=sent + timedelta(days=7)).order_by(
            "created_at"
        ).values_list("created_at", flat=True).first()
        if after is not None:
            lags.append(after - sent)

    # Most active organizations and people.
    by_org = Counter()
    org_people: dict = defaultdict(set)
    for org_id, actor_id in Activity.objects.filter(in_range).exclude(goal__org_id=None).values_list("goal__org_id", "actor_id"):
        by_org[org_id] += 1
        if actor_id:
            org_people[org_id].add(actor_id)
    org_names = dict(Organization.objects.filter(id__in=list(by_org)).values_list("id", "name"))
    top_count = max(by_org.values(), default=0)
    top_orgs = [[org_names.get(o, "(deleted)"), {"text": c, "bar": c / top_count}, len(org_people[o])] for o, c in by_org.most_common(10)]
    by_user = Counter(str(a) for a in Activity.objects.filter(in_range).exclude(actor_id=None).values_list("actor_id", flat=True))
    names = _user_names(u for u, _ in by_user.most_common(10))
    top_user_count = max(by_user.values(), default=0)
    top_users = [[names.get(u, "(deleted)"), {"text": c, "bar": c / top_user_count}] for u, c in by_user.most_common(10)]

    # Organizations near a limit (80%+).
    near = []
    members = dict(OrgMembership.objects.filter(status="active").values("org_id").annotate(n=Count("id")).values_list("org_id", "n"))
    org_goals = dict(goals.exclude(status=GoalStatus.ARCHIVED).exclude(org_id=None).values("org_id").annotate(n=Count("id")).values_list("org_id", "n"))
    for org in Organization.objects.all():
        for what, key, used in (("members", "max_members", members.get(org.id, 0)), ("goals", "max_goals", org_goals.get(org.id, 0))):
            limit = org_limit(org.id, key)
            if limit and used >= 0.8 * limit:
                near.append([org.name, what, f"{used} / {limit}", _cell(used, limit)])

    return [
        {"kind": "table", "title": f"Of the {n} people active in this range, how many use…",
         "columns": [{"label": "Feature"}, {"label": "Users", "align": "end"}, {"label": "Of active"}, {"label": "Counts as"}],
         "rows": [[label, used, _cell(used, n), hint] for label, used, hint in features]},
        {"kind": "tiles", "title": "Goal outcomes", "items": [
            {"label": "Goals achieved", "value": goals.filter(Q(status=GoalStatus.COMPLETED) | Q(health="achieved")).count(), "hint": "All time"},
            {"label": "Goals archived (abandoned)", "value": goals.filter(status=GoalStatus.ARCHIVED).count(), "hint": "All time"},
            {"label": "Goals scored at cycle close", "value": scores.count(), "hint": "In this range"},
            {"label": "Average cycle score", "value": f"{statistics.mean(score_values):.2f}" if score_values else "—", "hint": "0-1"},
            *[{"label": f"Scored {label.lower()}", "value": outcomes.get(value, 0)} for value, label in GoalScore._meta.get_field("outcome").choices],
        ]},
        {"kind": "tiles", "title": "Reminders", "items": [
            {"label": "Reminders sent", "value": len(reminders)},
            {"label": "Followed by a check-in within 7 days", "value": _pct(len(lags), len(reminders))},
            {"label": "Median time to check in", "value": _duration(_median(lags))},
        ]},
        {"kind": "table", "title": "Most active organizations", "empty": "No goal activity in this range.",
         "columns": [{"label": "Organization"}, {"label": "Events", "align": "end"}, {"label": "People", "align": "end"}], "rows": top_orgs},
        {"kind": "table", "title": "Most active people", "empty": "No goal activity in this range.",
         "columns": [{"label": "User"}, {"label": "Events", "align": "end"}], "rows": top_users},
        {"kind": "table", "title": "Organizations near a limit (80%+)", "empty": "None - or no limits are set.",
         "columns": [{"label": "Organization"}, {"label": "Limit"}, {"label": "Used", "align": "end"}, {"label": ""}], "rows": near},
    ]


def register() -> None:
    register_insight_section(InsightSection(
        "activation", "Activation", activation, order=20,
        description="How far new accounts get, how long each step takes, by where they came from and what they chose at onboarding.",
    ))
    register_insight_section(InsightSection(
        "retention", "Retention", retention, order=30,
        description="Of each week's sign-ups, the share active in each later week; people and organizations gone quiet.",
    ))
    register_insight_section(InsightSection(
        "adoption", "Feature adoption", adoption, order=40,
        description="Which features active people use, how goals end, how reminders land, and who's most active.",
    ))
