"""The goals digest: a summary per user - what moved since the last
period, what's at risk or off track, what was achieved, which check-ins
are due - sent through their reminder URLs (`ReminderSettings.digest`),
daily or weekly at their chosen local hour. Run by `manage.py
goalnexa_jobs`, which also takes the daily `GoalSnapshot`s "what moved"
compares against.

It covers every goal the user can see - their own and their orgs' shared
ones - worked out as the API would for them (`as_user`), not with a
separate rule. Completed and archived goals are left out.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.test import RequestFactory
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.test import force_authenticate

from goalnexa.access import visible_goals
from goalnexa.authentication import ActorStub
from goalnexa.models import DigestFrequency, Goal, GoalHealth, GoalSnapshot, GoalStatus, Metric, ReminderSettings
from goalnexa.reminders import send

logger = logging.getLogger(__name__)

HEALTH_LABELS = dict(GoalHealth.choices)
MOVED_LIMIT = 5
DUE_LIMIT = 10


def as_user(user_id) -> Request:
    """A request acting as `user_id` - for scoping rows (access policy,
    org membership) outside of a real request."""
    django_request = RequestFactory().get("/")
    force_authenticate(django_request, user=ActorStub(id=str(user_id)))
    return Request(django_request)


def snapshot_goals(today) -> int:
    """Today's snapshot for every goal that doesn't have one yet."""
    goals = Goal.objects.exclude(status=GoalStatus.ARCHIVED).exclude(snapshots__date=today)
    rows = [
        GoalSnapshot(goal=g, date=today, progress=g.progress, projected_progress=g.projected_progress, health=g.health)
        for g in goals
    ]
    GoalSnapshot.objects.bulk_create(rows, ignore_conflicts=True)
    return len(rows)


def _zone(name: str):
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def is_due(settings: ReminderSettings, now) -> bool:
    local = now.astimezone(_zone(settings.timezone))
    if settings.digest == DigestFrequency.OFF or local.hour < settings.digest_hour:
        return False
    if settings.digest == DigestFrequency.WEEKLY and local.weekday() != settings.digest_weekday:
        return False
    if settings.last_digest_at is None:
        return True
    return settings.last_digest_at.astimezone(_zone(settings.timezone)).date() < local.date()


def _pct(value) -> str:
    return "—" if value is None else f"{float(value):.0f}%"


def compose(user_id, frequency: str, now, app_url: str = "") -> tuple[str, str] | None:
    """(title, body), or None when the user has no goals to report."""
    goals = list(
        Goal.objects.filter(visible_goals(as_user(user_id)))
        .exclude(status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])
        .order_by("title")
    )
    if not goals:
        return None
    since = timezone.localdate() - timedelta(days=7 if frequency == DigestFrequency.WEEKLY else 1)
    then = {}
    for snap in GoalSnapshot.objects.filter(goal__in=goals, date__lte=since).order_by("goal_id", "-date"):
        then.setdefault(snap.goal_id, snap.progress)

    counts = {h: sum(g.health == h for g in goals) for h in (GoalHealth.ON_TRACK, GoalHealth.AT_RISK, GoalHealth.OFF_TRACK)}
    period = "week" if frequency == DigestFrequency.WEEKLY else "day"
    title = (
        f"GoalNexa {'weekly' if period == 'week' else 'daily'} digest: {len(goals)} goal{'s' if len(goals) != 1 else ''}"
        f" - {counts[GoalHealth.ON_TRACK]} on track, {counts[GoalHealth.AT_RISK]} at risk,"
        f" {counts[GoalHealth.OFF_TRACK]} off track"
    )
    sections = []

    moved = []
    for g in goals:
        before = then.get(g.id)
        if g.progress is not None and before is not None and g.progress != before:
            moved.append((abs(g.progress - before), g, before))
    if moved:
        moved.sort(key=lambda row: row[0], reverse=True)
        lines = [
            f"- {g.title}: {_pct(before)} → {_pct(g.progress)} ({'+' if g.progress > before else ''}{float(g.progress - before):.0f})"
            for _, g, before in moved[:MOVED_LIMIT]
        ]
        sections.append(f"Moved this {period}:\n" + "\n".join(lines))

    attention = [g for g in goals if g.health in (GoalHealth.AT_RISK, GoalHealth.OFF_TRACK)]
    if attention:
        lines = []
        for g in attention:
            detail = f"{_pct(g.progress)}"
            if g.target_date and g.target_date < timezone.localdate():
                detail += f", target passed {g.target_date:%b %d}"
            elif g.projected_progress is not None and g.target_date:
                detail += f", projected {_pct(g.projected_progress)} by {g.target_date:%b %d}"
            lines.append(f"- {HEALTH_LABELS[g.health]}: {g.title} ({detail})")
        sections.append("Needs attention:\n" + "\n".join(lines))

    achieved = [g for g in goals if g.health == GoalHealth.ACHIEVED]
    if achieved:
        sections.append("Achieved:\n" + "\n".join(f"- {g.title}" for g in achieved))

    due = list(
        Metric.objects.filter(goal__in=goals, check_in_due_at__lte=now).select_related("goal").order_by("check_in_due_at")
    )
    if due:
        lines = [f"- {m.goal.title} → {m.name}" for m in due[:DUE_LIMIT]]
        if len(due) > DUE_LIMIT:
            lines.append(f"- and {len(due) - DUE_LIMIT} more")
        sections.append("Check-ins due:\n" + "\n".join(lines))

    if not sections:
        sections.append("Nothing moved, nothing's at risk and no check-ins are due.")
    body = "\n\n".join(sections)
    if app_url:
        body += f"\n\nDashboard: {app_url.rstrip('/')}/dashboard"
    return title, body


def send_due_digests(now=None) -> int:
    """Sends every digest that's due; returns how many went out."""
    now = now or timezone.now()
    sent = 0
    for settings in ReminderSettings.objects.filter(enabled=True).exclude(digest=DigestFrequency.OFF).exclude(urls=""):
        urls = settings.url_list()
        if not urls or not is_due(settings, now):
            continue
        # Claim it first (the previous value must still be there), so two
        # schedulers never both send it.
        claimed = ReminderSettings.objects.filter(id=settings.id, last_digest_at=settings.last_digest_at)
        if settings.last_digest_at is None:
            claimed = ReminderSettings.objects.filter(id=settings.id, last_digest_at__isnull=True)
        if not claimed.update(last_digest_at=now):
            continue
        message = compose(settings.user_id, settings.digest, now, settings.app_url)
        if message is None:
            continue
        try:
            if send(urls, *message):
                sent += 1
            else:
                logger.warning("Digest to user %s was not delivered", settings.user_id)
        except Exception:
            logger.exception("Digest to user %s failed", settings.user_id)
    return sent
