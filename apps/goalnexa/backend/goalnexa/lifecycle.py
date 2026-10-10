"""goalnexa's lifecycle email (`core_api.lifecycle`; design:
docs/lifecycle-email.md): the email categories users choose from, the
signals goalnexa's writes report, and four journeys - onboarding, tips,
milestones and win-back. The team journeys join orgs and goals, so they
live in the host (`config/lifecycle.py`).

Every step decides when it's due whether it still applies (its `render`
returns None to skip), from the current data - not from what was true
when the user entered the journey.

Copy rules: short, one action, the button lands on the exact page. Users
who chat with an assistant get what to say to it, not "open the website".
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from core_api.lifecycle import SEEN, Enrolled, Journey, Message, Step, StepContext, record_signal
from core_api.system import EmailCategory, last_seen, public_url, register_email_category, users_last_seen_between

#: Email categories (`core_api.system.EmailCategory`).
REMINDERS, TIPS, PROGRESS = "reminders", "tips", "progress"

#: Recent changes, newest first - the win-back "what's new" email lists the top ones.
WHATS_NEW = [
    "Check in by chat: connect Claude or ChatGPT and just say \"ran 5 km today\".",
    "The check-in table: every metric and its check-ins on one page, with a goal picker.",
    "Predictions: each goal with a target date shows where it'll land at the current pace.",
    "Public dashboard links: share chosen goals with anyone, read-only and always current.",
    "Cycles: run goals by quarter and close them with a scorecard.",
]


def _goals():
    from goalnexa.models import Goal, GoalStatus

    return Goal.objects.exclude(status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])


def _check_ins(user_id):
    from goalnexa.models import CheckIn

    return CheckIn.objects.filter(author_id=user_id)


def _choice(user_id) -> str:
    from goalnexa.models import OnboardingChoice

    return OnboardingChoice.objects.filter(user_id=user_id).values_list("choice", flat=True).first() or ""


def _uses_assistant(user_id) -> bool:
    from goalnexa.models import CheckInSource

    return _choice(user_id) == "agent" or _check_ins(user_id).filter(source=CheckInSource.AGENT).exists()


def _goal_link(goal) -> str:
    return f"/dashboard?goal={goal.id}"


# --- onboarding --------------------------------------------------------------


def _welcome(ctx: StepContext) -> Message:
    if _choice(ctx.user_id) == "agent":
        return Message(
            "Welcome to GoalNexa",
            ["You can run GoalNexa entirely from Claude or ChatGPT: set a goal, check in, ask how it's going.",
             "Connect your assistant once - it takes a minute."],
            ("Connect an assistant", "/mcp"),
            ["Then say: \"Help me set a goal in GoalNexa.\""],
        )
    return Message(
        "Welcome to GoalNexa",
        ["GoalNexa turns a goal into a few numbers you check in on, and shows whether you're on track.",
         "Start with one goal and one number - you can add the rest later."],
        ("Create your first goal", "/dashboard"),
        ["Prefer chat? Connect Claude or ChatGPT" + (f" ({public_url('/mcp')})" if public_url() else "")
         + " and check in by just saying what you did."],
    )


def _first_goal(ctx: StepContext) -> Message | None:
    if _goals().filter(owner_id=ctx.user_id).exists():
        return None
    return Message(
        "Your first goal in 2 minutes",
        ["A goal is an outcome with a date, measured by a number. For example:",
         "Run a half marathon by June 1 - measured by \"longest run\", from 5 km to 21 km.",
         "Pick yours and write it down - that's the whole setup."],
        ("Create a goal", "/dashboard"),
        ["With an assistant connected, say: \"Help me set a goal in GoalNexa.\""],
    )


def _first_check_in(ctx: StepContext) -> Message | None:
    goal = _goals().filter(owner_id=ctx.user_id).order_by("created_at").first()
    if goal is None or _check_ins(ctx.user_id).exists():
        return None
    after = (["Or tell your assistant the number, e.g. \"" + goal.title + ": we're at 12 today.\""]
             if _uses_assistant(ctx.user_id) else [])
    return Message(
        "Log your first number",
        [f"You set up \"{goal.title}\". Its chart starts with your first check-in - today's number, whatever it is.",
         "Progress you don't log is progress you can't see."],
        ("Check in now", _goal_link(goal)),
        after,
    )


def _go_mobile(ctx: StepContext) -> Message | None:
    if _check_ins(ctx.user_id).exists() or _uses_assistant(ctx.user_id):
        return None
    return Message(
        "Check in from your phone, by chat",
        ["Most people check in from wherever they are. Connect Claude or ChatGPT once, then just say what you did:",
         "\"Ran 5 km today.\" \"We're at 420 users.\"",
         "It finds the metric, logs it and tells you where the goal stands."],
        ("Connect an assistant", "/mcp"),
    )


def _first_week(ctx: StepContext) -> Message | None:
    from goalnexa.models import Metric

    goals = _goals().filter(owner_id=ctx.user_id).count()
    metrics = Metric.objects.filter(goal__owner_id=ctx.user_id).count()
    if goals == 0:
        return Message(
            "One week in",
            ["You signed up a week ago but haven't set a goal yet. If something got in the way, just reply - "
             "a person reads these."],
            ("Set a goal", "/dashboard"),
        )
    return Message(
        "One week in",
        [f"You have {goals} goal{'s' if goals != 1 else ''} and {metrics} metric{'s' if metrics != 1 else ''}. "
         "The one step left: a first check-in, so the chart has something to show."],
        ("Check in", "/table"),
    )


def _activated(enrollment: Enrolled, now) -> str | None:
    return "checked in" if _check_ins(enrollment.user_id).exists() else None


ONBOARDING = Journey(
    "onboarding", "Onboarding", TIPS, trigger="signup", exit=_activated,
    description="From signup to the first check-in. Ends at the first check-in.",
    steps=[
        Step("welcome", timedelta(0), _welcome, target="goal_created", label="Welcome"),
        Step("first-goal", timedelta(hours=24), _first_goal, target="goal_created", label="No goal yet (+1 day)"),
        Step("first-check-in", timedelta(hours=48), _first_check_in, target="check_in",
             label="Goal, no check-in (+2 days)"),
        Step("go-mobile", timedelta(days=4), _go_mobile, target="check_in", label="Check in by chat (+4 days)"),
        Step("first-week", timedelta(days=7), _first_week, target="check_in", label="One week in (+7 days)"),
    ],
)


# --- tips: one a week, only for what the user hasn't used ----------------------


def _tip_reminders(ctx: StepContext) -> Message | None:
    from goalnexa.models import Metric, ReminderSettings

    row = ReminderSettings.objects.filter(user_id=ctx.user_id).first()
    if Metric.objects.filter(goal__owner_id=ctx.user_id).exclude(check_in_every="").exists() and row and (
        row.url_list() or row.email
    ):
        return None
    return Message(
        "Tip: get reminded when a check-in is due",
        ["Give a metric a schedule (daily, weekly, monthly) and GoalNexa reminds you when it's due - by email, "
         "Telegram, Slack and more."],
        ("Set up reminders", "/reminders"),
    )


def _tip_assistant(ctx: StepContext) -> Message | None:
    if _uses_assistant(ctx.user_id):
        return None
    return Message(
        "Tip: check in by chat",
        ["Connect Claude or ChatGPT once, and checking in is one sentence from your phone: \"ran 5 km today\". "
         "Ask it how your goals are going, too."],
        ("Connect an assistant", "/mcp"),
    )


def _tip_share(ctx: StepContext) -> Message | None:
    from goalnexa.models import DashboardShare

    goal = _goals().filter(owner_id=ctx.user_id).order_by("created_at").first()
    if goal is None or DashboardShare.objects.filter(owner_id=ctx.user_id).exists():
        return None
    return Message(
        "Tip: share your progress with a link",
        ["Your dashboard's Share button makes a read-only link to the goals you choose - for a coach, a friend or "
         "your team. It stays current, and you can revoke it anytime."],
        ("Open your dashboard", _goal_link(goal)),
    )


def _tip_ingest(ctx: StepContext) -> Message | None:
    from goalnexa.models import Metric

    metrics = Metric.objects.filter(goal__owner_id=ctx.user_id)
    if not metrics.exists() or metrics.exclude(ingest_token_hash="").exists():
        return None
    metric = metrics.order_by("created_at").first()
    return Message(
        "Tip: let a script check in for you",
        ["A number that already lives somewhere - signups, revenue, steps - can check itself in. Each metric has an "
         "ingest URL: a script, a cron job or a webhook posts the value, no login needed."],
        ("Get the ingest URL", f"/metrics/{metric.id}"),
    )


def _tip_cycles(ctx: StepContext) -> Message | None:
    from goalnexa.models import Cycle

    if Cycle.objects.filter(owner_id=ctx.user_id).exists() or _goals().filter(owner_id=ctx.user_id).count() < 2:
        return None
    return Message(
        "Tip: run your goals by quarter",
        ["A cycle groups goals for a period - a quarter, a season. At the end, close it: each goal is scored, and "
         "the unfinished ones roll over to the next cycle with their metrics."],
        ("Start a cycle", "/cycles"),
    )


TIPS_JOURNEY = Journey(
    "tips", "Feature tips", TIPS, trigger="first_check_in",
    description="One tip a week after the first check-in, only for features the user hasn't used.",
    steps=[
        Step("reminders", timedelta(days=3), _tip_reminders, target=SEEN, label="Reminders (+3 days)"),
        Step("assistant", timedelta(days=10), _tip_assistant, target="check_in", label="Check in by chat (+10 days)"),
        Step("share", timedelta(days=17), _tip_share, target=SEEN, label="Share link (+17 days)"),
        Step("ingest", timedelta(days=24), _tip_ingest, target=SEEN, label="Ingest URL (+24 days)"),
        Step("cycles", timedelta(days=31), _tip_cycles, target=SEEN, label="Cycles (+31 days)"),
    ],
)


# --- milestones ------------------------------------------------------------------


def _milestone(ctx: StepContext) -> Message | None:
    from goalnexa.models import Goal

    kind = ctx.data.get("kind")
    if kind == "streak":
        weeks = ctx.data.get("weeks", 4)
        return Message(
            f"{weeks} weeks in a row",
            [f"You've checked in every week for {weeks} weeks. That's the habit that moves goals - keep it going."],
            ("See your progress", "/dashboard"),
        )
    goal = Goal.objects.filter(id=ctx.data.get("goal_id")).first()
    if goal is None or goal.status == "archived":
        return None
    if kind == "half":
        if goal.progress is None or goal.progress < 50:
            return None
        return Message(
            f"Halfway there: {goal.title}",
            [f"\"{goal.title}\" just passed 50%. The second half is where most goals stall - a regular check-in "
             "keeps it moving."],
            ("See the goal", _goal_link(goal)),
            ["Proud of it? The dashboard's Share button makes a link to show it."],
        )
    if kind == "done":
        return Message(
            f"You did it: {goal.title}",
            [f"\"{goal.title}\" reached 100%. Well done.",
             "Mark it completed, or raise the target if there's more in it - then pick what's next."],
            ("See the goal", _goal_link(goal)),
        )
    return None


MILESTONES = Journey(
    "milestones", "Milestones", PROGRESS, trigger="milestone",
    description="A goal passing 50% or reaching 100%, and 4 / 12 weeks in a row with a check-in.",
    steps=[Step("celebrate", timedelta(0), _milestone, target="check_in", label="Celebrate")],
)


# --- win-back ---------------------------------------------------------------------


def _idle_users(now):
    """Users whose last activity was 7-10 days ago (so the journey only
    picks up fresh lapses, never a backlog), once per lapse."""
    for user_id, seen_at in users_last_seen_between(now - timedelta(days=10), now - timedelta(days=7)):
        yield user_id, seen_at.date().isoformat(), {"since": seen_at.isoformat()}


def _came_back(enrollment: Enrolled, now) -> str | None:
    seen_at = last_seen([enrollment.user_id]).get(enrollment.user_id)
    since = enrollment.data.get("since")
    return "came back" if seen_at and since and seen_at.isoformat() > since else None


def _overdue(ctx: StepContext) -> Message | None:
    from goalnexa.models import Metric

    due = list(
        Metric.objects.filter(goal__in=_goals().filter(owner_id=ctx.user_id), check_in_due_at__lte=ctx.now)
        .select_related("goal").order_by("check_in_due_at")[:5]
    )
    if not due:
        return None
    lines = "\n".join(f"- {m.goal.title} → {m.name}" for m in due)
    after = ["Or tell your assistant the numbers - it logs them for you."] if _uses_assistant(ctx.user_id) else []
    return Message(
        f"{len(due)} check-in{'s are' if len(due) != 1 else ' is'} waiting",
        ["These are due:", lines, "Today's numbers, whatever they are, keep the charts honest."],
        ("Check in", "/table"),
        after,
    )


def _still_right(ctx: StepContext) -> Message | None:
    goal = (
        _goals().filter(owner_id=ctx.user_id).exclude(health="achieved").order_by("-updated_at").first()
    )
    if goal is None:
        return None
    return Message(
        f"Is \"{goal.title}\" still the right goal?",
        ["Goals change. If this one still matters, a check-in shows where it stands; if the target was off, "
         "adjust it; if it's done with, archive it so it stops nagging you."],
        ("Review the goal", _goal_link(goal)),
    )


def _whats_new(ctx: StepContext) -> Message:
    return Message(
        "What's new in GoalNexa",
        ["A few things changed since you were last here:", "\n".join(f"- {line}" for line in WHATS_NEW[:4])],
        ("Have a look", "/dashboard"),
    )


def _goodbye(ctx: StepContext) -> Message:
    return Message(
        "We'll stop emailing for now",
        ["You haven't been back in a while, so this is the last of these emails. Your goals and data stay "
         "where they are - come back anytime and pick up where you left off."],
        ("Open GoalNexa", "/dashboard"),
        ["If something didn't work for you, a reply helps - a person reads them."],
    )


WIN_BACK = Journey(
    "win-back", "Win-back", PROGRESS, enter=_idle_users, exit=_came_back, ignore_sunset=True,
    description="After 7 days without activity; ends when the user is back.",
    steps=[
        Step("overdue", timedelta(0), _overdue, target=SEEN, label="Check-ins waiting (day 7)"),
        Step("still-right", timedelta(days=7), _still_right, target=SEEN, label="Still the right goal? (day 14)"),
        Step("whats-new", timedelta(days=23), _whats_new, target=SEEN, label="What's new (day 30)"),
        Step("goodbye", timedelta(days=53), _goodbye, target=SEEN, label="Last email (day 60)"),
    ],
)


# --- signals from goalnexa's writes ---------------------------------------------


def on_activity(actor_id, verb: str, goal_id) -> None:
    """Called by `goalnexa.activity.record` for every user action."""
    from goalnexa.models import ActivityVerb

    from core_api.lifecycle import enabled

    if not actor_id or not enabled():
        return
    if verb == ActivityVerb.GOAL_CREATED:
        record_signal(actor_id, "goal_created", goal_id=str(goal_id))
    elif verb == ActivityVerb.METRIC_ADDED:
        record_signal(actor_id, "metric_created", goal_id=str(goal_id))
    elif verb == ActivityVerb.CHECKED_IN:
        record_signal(actor_id, "check_in", goal_id=str(goal_id))
        check_ins = _check_ins(actor_id)
        if check_ins.count() == 1:
            record_signal(actor_id, "first_check_in")
        weeks = _streak_weeks(check_ins)
        for target in (4, 12):
            if weeks == target:
                record_signal(actor_id, "milestone", kind="streak", weeks=target, key=f"streak-{target}")


def _streak_weeks(check_ins) -> int:
    """Consecutive ISO weeks with a check-in, ending this week."""
    since = timezone.now() - timedelta(weeks=13)
    weeks = {d.isocalendar()[:2] for d in check_ins.filter(checked_in_at__gte=since).values_list("checked_in_at", flat=True)}
    count, day = 0, timezone.now().date()
    while day.isocalendar()[:2] in weeks:
        count += 1
        day -= timedelta(weeks=1)
    return count


def on_progress(goal, before, after) -> None:
    """Called by `goalnexa.progress.refresh_goal` when a goal's progress changes."""
    if after is None:
        return
    before = before or 0
    if before < 50 <= after < 100:
        record_signal(goal.owner_id, "milestone", kind="half", goal_id=str(goal.id), key=f"{goal.id}:50")
    elif before < 100 <= after:
        record_signal(goal.owner_id, "milestone", kind="done", goal_id=str(goal.id), key=f"{goal.id}:100")


def _digest_by_default(user_id, data) -> None:
    """New accounts get the weekly digest by email (they can turn it off)."""
    from goalnexa.models import DigestFrequency, ReminderSettings

    ReminderSettings.objects.get_or_create(
        user_id=user_id,
        defaults={"email": True, "digest": DigestFrequency.WEEKLY,
                  "app_url": getattr(settings, "GOALNEXA_PUBLIC_URL", "") or ""},
    )


def register() -> None:
    from core_api.lifecycle import on_signal, register_journey

    register_email_category(EmailCategory(
        REMINDERS, "Reminders & digest", order=10,
        help="Check-in reminders and the goals digest, when you've chosen email for them on the Reminders page.",
    ))
    register_email_category(EmailCategory(
        TIPS, "Tips & getting started", order=20,
        help="Help getting set up, and the occasional tip for a feature you haven't tried.",
    ))
    register_email_category(EmailCategory(
        PROGRESS, "Progress & milestones", order=30,
        help="Milestones you reach, and a nudge when check-ins are waiting.",
    ))
    for journey in (ONBOARDING, TIPS_JOURNEY, MILESTONES, WIN_BACK):
        register_journey(journey)
    on_signal("signup", _digest_by_default)
