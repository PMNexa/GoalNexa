"""`manage.py goalnexa_jobs [--loop SECONDS]` - goalnexa's time-driven work,
what no request triggers:

- goals whose target date just passed get their health recomputed
  (`goalnexa.progress` - an on-track goal past its date is off track);
- overdue check-in reminders go out (`goalnexa.reminders`).

Once, or forever with `--loop` (the `scheduler` service in the compose
and stack files). Safe to run more than once at a time.
"""

import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from goalnexa.models import Goal, GoalHealth
from goalnexa.progress import refresh_goal
from goalnexa.reminders import send_due_reminders

logger = logging.getLogger(__name__)


def run_once() -> dict:
    today = timezone.localdate()
    lapsed = Goal.objects.filter(target_date__lt=today, health__in=[GoalHealth.ON_TRACK, GoalHealth.AT_RISK])
    refreshed = 0
    for goal_id in lapsed.values_list("id", flat=True):
        refresh_goal(goal_id)
        refreshed += 1
    return {"goals_refreshed": refreshed, "users_reminded": send_due_reminders()}


class Command(BaseCommand):
    help = "Recompute time-dependent goal health and send due check-in reminders."

    def add_arguments(self, parser):
        parser.add_argument("--loop", type=int, default=0, metavar="SECONDS", help="Repeat every SECONDS (0 = once).")

    def handle(self, *args, loop, **options):
        while True:
            try:
                result = run_once()
                if any(result.values()) or not loop:
                    self.stdout.write(f"{timezone.now().isoformat()} {result}")
            except Exception:
                if not loop:
                    raise
                logger.exception("goalnexa_jobs run failed")
            if not loop:
                return
            close_old_connections()
            time.sleep(loop)
