"""goalnexa's part of System > Insights (`core_api.system`): daily numbers
for goals and check-ins, who's engaged, and how long the feed and the
daily goal snapshots are kept (data retention)."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from core_api.system import InsightSeries, RetentionRule, register_insight_series, register_retention_rule

from goalnexa.models import Activity, CheckIn, CheckInSource, Goal, GoalSnapshot, Metric

#: "Engaged" = checked in within this many days.
ENGAGED_DAYS = 7


def end_of(day) -> datetime:
    return datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=dt_timezone.utc)


def _check_ins(day, source=None):
    rows = CheckIn.objects.filter(created_at__gte=end_of(day) - timedelta(days=1), created_at__lt=end_of(day))
    return (rows.filter(source=source) if source else rows).count()


def engaged_users(day) -> int:
    """People who checked in during the `ENGAGED_DAYS` ending on `day`."""
    return (
        CheckIn.objects.filter(created_at__gte=end_of(day) - timedelta(days=ENGAGED_DAYS), created_at__lt=end_of(day))
        .exclude(author_id=None)
        .values("author_id")
        .distinct()
        .count()
    )


def register_insights() -> None:
    register_insight_series(InsightSeries(
        "goals", "Goals", "Goals", lambda day: Goal.objects.filter(created_at__lt=end_of(day)).count(),
        help="Goals that exist (deleted ones aren't counted).",
    ))
    register_insight_series(InsightSeries(
        "metrics", "Metrics", "Goals", lambda day: Metric.objects.filter(created_at__lt=end_of(day)).count(),
    ))
    register_insight_series(InsightSeries("check_ins", "Check-ins", "Goals", _check_ins, kind="daily"))
    register_insight_series(InsightSeries(
        "check_ins_agent", "Check-ins by AI assistant", "Goals", lambda day: _check_ins(day, CheckInSource.AGENT),
        kind="daily",
    ))
    register_insight_series(InsightSeries(
        "engaged", "Engaged users", "Activity", engaged_users,
        help=f"Checked in during the last {ENGAGED_DAYS} days.",
    ))
    register_retention_rule(RetentionRule(
        "activity", "goal activity feeds", lambda cutoff: Activity.objects.filter(created_at__lt=cutoff).delete()[0],
        help="The feed on each goal (check-ins, changes, comments as events). Comments themselves stay.",
    ))
    register_retention_rule(RetentionRule(
        "goal_snapshots", "daily goal snapshots",
        lambda cutoff: GoalSnapshot.objects.filter(date__lt=cutoff.date()).delete()[0],
        help="Each goal's progress per day, which the email digest compares against.",
    ))
