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

The `reminders.allowed_schemes` system setting (editable by an admin;
default from the host's `GOALNEXA_REMINDER_SCHEMES`) limits which Apprise
schemes a user may save - on a shared (SaaS) instance, leave out ones that
reach the server's own network or files (`json`, `xml`, `form`,
`syslog`, ...). Empty = any. A user can also turn on `email`: reminders
then go to their account email through the instance's own mail server
(`core_api.system.send_email`) - safe on any instance.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from urllib.parse import urlsplit

from django.conf import settings
from django.utils.module_loading import import_string
from django.utils import timezone

from core_api.system import get_setting, log_delivery, send_email
from goalnexa.models import GoalStatus, Metric, ReminderSettings

logger = logging.getLogger(__name__)


def allowed_schemes() -> set[str] | None:
    """The `reminders.allowed_schemes` system setting; empty = any."""
    schemes = get_setting("reminders.allowed_schemes")
    return {s.lower() for s in schemes} if schemes else None


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


def user_email(user_id) -> str:
    """The user's email, from the host's user directory
    (`GOALNEXA_USER_DIRECTORY`, a dotted path to `fn(ids) -> {id: {"email"}}`)."""
    path = getattr(settings, "GOALNEXA_USER_DIRECTORY", None)
    if not path:
        return ""
    return (import_string(path)([user_id]).get(str(user_id)) or {}).get("email") or ""


def has_channel(reminder_settings: ReminderSettings) -> bool:
    return bool(reminder_settings.url_list()) or reminder_settings.email


def deliver(reminder_settings: ReminderSettings, title: str, body: str, kind: str = "reminder") -> bool:
    """Sends a message on every channel the user set up: their Apprise URLs,
    and their account email (through the instance's outbox) when `email`
    is on. True when at least one took it."""
    ok = False
    urls = reminder_settings.url_list()
    if urls:
        error = ""
        try:
            sent = send(urls, title, body)
        except Exception as exc:
            logger.exception("Apprise delivery to user %s failed", reminder_settings.user_id)
            sent, error = False, str(exc)
        # Only the services, never the URLs - they carry tokens.
        services = ", ".join(sorted({urlsplit(url).scheme for url in urls}))
        log_delivery("apprise", kind, user_id=reminder_settings.user_id, target=services, ok=sent,
                     error=error or ("" if sent else "Apprise reported a failure - check the URLs."))
        ok = sent or ok
    if reminder_settings.email:
        address = user_email(reminder_settings.user_id)
        if address:
            send_email(address, title, body, kind=kind, user_id=reminder_settings.user_id)
            ok = True
    return ok


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
        if reminder_settings is None or not has_channel(reminder_settings):
            continue
        claimed = [
            m
            for m in metrics
            if Metric.objects.filter(id=m.id, reminded_at__isnull=True).update(reminded_at=now)
        ]
        if not claimed:
            continue
        title, body = _message(claimed, reminder_settings.app_url, now)
        ok = deliver(reminder_settings, title, body)
        if ok:
            sent += 1
        else:
            logger.warning("Reminder to user %s was not delivered", owner_id)
    return sent
