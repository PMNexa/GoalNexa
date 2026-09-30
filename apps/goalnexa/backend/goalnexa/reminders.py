"""Check-in reminders: a metric with a schedule (`Metric.check_in_every`)
whose `check_in_due_at` has passed is overdue; its goal's owner gets ONE
message per run listing their overdue metrics, through the Apprise URLs
in their `ReminderSettings` (email, ntfy, Telegram, Slack, Discord, a
JSON webhook, ... - https://github.com/caronc/apprise/wiki). Nobody else
is messaged: an org goal's owner is who answers for it.

A metric is reminded once per due date: `reminded_at` is set when it
goes out and cleared whenever the due date moves (`refresh_metric`). It's
claimed with a conditional UPDATE first, so two schedulers running at once (a rolling
deploy) can't both send it. A user with no reminder settings yet isn't
marked, so setting them up later still reminds them of what's overdue.
Completed and archived goals are skipped.

`GOALNEXA_REMINDER_SCHEMES` (settings) limits which Apprise schemes a
user may save - on a shared (SaaS) instance, leave out ones that reach
the server's own network or files (`json`, `xml`, `form`, `syslog`, ...).
Unset = any.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from urllib.parse import urlsplit

from django.conf import settings
from django.utils import timezone

from goalnexa.models import GoalStatus, Metric, ReminderSettings

logger = logging.getLogger(__name__)


def allowed_schemes() -> set[str] | None:
    schemes = getattr(settings, "GOALNEXA_REMINDER_SCHEMES", None)
    return None if schemes is None else {s.lower() for s in schemes}


def validate_urls(urls: list[str]) -> list[str]:
    """Error messages for URLs Apprise can't use or this instance doesn't allow."""
    import apprise

    allowed = allowed_schemes()
    errors = []
    for url in urls:
        scheme = urlsplit(url).scheme.lower()
        if not scheme:
            errors.append(f"Not a URL: {url}")
        elif allowed is not None and scheme not in allowed:
            errors.append(f"{scheme}:// isn't allowed here. Allowed: {', '.join(sorted(allowed))}.")
        elif not apprise.Apprise().add(url):
            errors.append(f"Apprise doesn't recognize {scheme}:// - see its wiki for the URL format.")
    return errors


def send(urls: list[str], title: str, body: str) -> bool:
    import apprise

    notifier = apprise.Apprise()
    for url in urls:
        notifier.add(url)
    return bool(notifier.notify(title=title, body=body))


def overdue_metrics(now=None):
    now = now or timezone.now()
    return (
        Metric.objects.filter(check_in_due_at__lte=now, reminded_at__isnull=True)
        .exclude(goal__status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])
        .select_related("goal")
        .order_by("goal__title", "name")
    )


def _amount(value) -> str:
    return format(value.normalize(), "f")  # 79.00 -> "79", 100.00 -> "100"


def _message(metrics: list[Metric], app_url: str, now) -> tuple[str, str]:
    lines = []
    for metric in metrics:
        days = (now - metric.check_in_due_at).days
        late = "due today" if days < 1 else f"{days} day{'s' if days != 1 else ''} overdue"
        unit = f" {metric.unit}" if metric.unit else ""
        lines.append(
            f"- {metric.goal.title} → {metric.name}: {_amount(metric.current_value)}/{_amount(metric.target_value)}{unit} ({late})"
        )
    title = f"GoalNexa: {len(metrics)} check-in{'s' if len(metrics) != 1 else ''} due"
    body = "\n".join(lines)
    if app_url:
        body += f"\n\nCheck in: {app_url.rstrip('/')}/dashboard"
    return title, body


def send_due_reminders(now=None) -> int:
    """Sends every due reminder; returns how many users were messaged."""
    now = now or timezone.now()
    by_owner: dict[str, list[Metric]] = defaultdict(list)
    for metric in overdue_metrics(now):
        by_owner[str(metric.goal.owner_id)].append(metric)
    if not by_owner:
        return 0
    settings_by_user = {
        str(s.user_id): s for s in ReminderSettings.objects.filter(user_id__in=list(by_owner), enabled=True)
    }
    sent = 0
    for owner_id, metrics in by_owner.items():
        reminder_settings = settings_by_user.get(owner_id)
        urls = reminder_settings.url_list() if reminder_settings else []
        if not urls:
            continue
        claimed = [
            m
            for m in metrics
            if Metric.objects.filter(id=m.id, reminded_at__isnull=True).update(reminded_at=now)
        ]
        if not claimed:
            continue
        title, body = _message(claimed, reminder_settings.app_url, now)
        try:
            ok = send(urls, title, body)
        except Exception:  # a broken URL must not stop everyone else's reminders
            logger.exception("Reminder to user %s failed", owner_id)
            ok = False
        if ok:
            sent += 1
        else:
            logger.warning("Reminder to user %s was not delivered", owner_id)
    return sent
