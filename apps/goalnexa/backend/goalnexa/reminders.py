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

#: An end-of-period nudge goes out from this hour (local) on a period's last counted day.
NUDGE_HOUR = 18

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
            # "Reminders & digest" - the user can turn it off from the email's own link.
            ok = send_email(address, title, body, kind=kind, user_id=reminder_settings.user_id,
                            category="reminders") or ok
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


def short_of_quota(now=None) -> list[tuple[Metric, object, float]]:
    """Metrics with a target per period whose current period ends today
    (its last counted day, from NUDGE_HOUR local time) still under quota,
    not nudged for this period yet: `(metric, period, quota)`."""
    from goalnexa.periods import current_quota, local_date, zone_for

    now = now or timezone.now()
    zones: dict = {}
    found = []
    candidates = (
        Metric.objects.exclude(target_per="")
        .filter(goal__is_rollup=False)
        .exclude(goal__status__in=[GoalStatus.COMPLETED, GoalStatus.ARCHIVED])
        .select_related("goal__cycle")
    )
    for metric in candidates:
        if metric.target_value == metric.base_value:
            continue
        zone = zone_for(metric.goal, zones)
        local = now.astimezone(zone)
        today = local_date(now, zone)
        period, quota = current_quota(metric, metric.goal, today=today, zone=zone)
        if period is None or period.last != today or local.hour < NUDGE_HOUR:
            continue
        if metric.period_reminded_for == period.start or float(metric.period_value or 0) >= quota:
            continue
        found.append((metric, period, quota))
    return found


def _nudge_lines(nudges) -> list[str]:
    from goalnexa.periods import PERIOD_NOUNS

    lines = []
    for metric, _period, quota in nudges:
        done = float(metric.period_value or 0)
        unit = f" {metric.unit}" if metric.unit else ""
        label = PERIOD_NOUNS[metric.target_per][0]
        lines.append(
            f"- {metric.goal.title} → {metric.name}: {done:g}/{quota:g}{unit} {label} ({quota - done:g} to go)"
        )
    return lines


def send_due_reminders(now=None) -> int:
    """Sends every due reminder - overdue check-ins and quotas still short
    at the end of their period - one message per goal owner; returns how
    many users were messaged."""
    now = now or timezone.now()
    by_owner: dict[str, list[Metric]] = defaultdict(list)
    for metric in overdue_metrics(now):
        by_owner[str(metric.goal.owner_id)].append(metric)
    nudges_by_owner: dict[str, list] = defaultdict(list)
    for nudge in short_of_quota(now):
        nudges_by_owner[str(nudge[0].goal.owner_id)].append(nudge)
    if not by_owner and not nudges_by_owner:
        return 0
    settings_by_user = {
        str(s.user_id): s
        for s in ReminderSettings.objects.filter(user_id__in=list(set(by_owner) | set(nudges_by_owner)), enabled=True)
    }
    sent = 0
    for owner_id in set(by_owner) | set(nudges_by_owner):
        reminder_settings = settings_by_user.get(owner_id)
        if reminder_settings is None or not has_channel(reminder_settings):
            continue
        claimed = [
            m
            for m in by_owner.get(owner_id, [])
            if Metric.objects.filter(id=m.id, reminded_at__isnull=True).update(reminded_at=now)
        ]
        # Claimed like reminders - two schedulers can't both nudge.
        nudges = [
            (m, period, quota)
            for m, period, quota in nudges_by_owner.get(owner_id, [])
            if Metric.objects.filter(id=m.id)
            .exclude(period_reminded_for=period.start)
            .update(period_reminded_for=period.start)
        ]
        if not claimed and not nudges:
            continue
        if claimed:
            title, body = _message(claimed, reminder_settings.app_url, now)
            if nudges:
                body = body.replace("\n\nCheck in:", "\n\nStill short:\n" + "\n".join(_nudge_lines(nudges)) + "\n\nCheck in:", 1)
                if "Still short:" not in body:
                    body += "\n\nStill short:\n" + "\n".join(_nudge_lines(nudges))
        else:
            title = f"GoalNexa: {len(nudges)} target{'s' if len(nudges) != 1 else ''} still short"
            body = "\n".join(_nudge_lines(nudges))
            if reminder_settings.app_url:
                body += f"\n\nCheck in: {reminder_settings.app_url.rstrip('/')}/dashboard"
        ok = deliver(reminder_settings, title, body)
        if ok:
            sent += 1
        else:
            logger.warning("Reminder to user %s was not delivered", owner_id)
    return sent
