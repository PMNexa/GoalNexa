"""When a time zone changes (P-106): a goal's frequency, quotas and due times
count in its zone (`periods.zone_for`: the org's, else the goal owner's
`ReminderSettings.timezone`, else UTC), so the goals it covers are re-stamped
and recomputed - a "Monday 09:00" check-in moves to 09:00 in the new zone,
from the time each check-in was given (`CheckIn.entered_at`)."""

from django.db import transaction
from django.db.models import Q

ORGS_ENDPOINT = "/api/v1/orgs"


def rezone(goals) -> int:
    """Re-stamps the check-ins of every metric of `goals` (a Goal queryset)
    and refreshes them. Returns how many metrics were refreshed."""
    from goalnexa import rollups
    from goalnexa.models import Metric
    from goalnexa.periods import resnap
    from goalnexa.progress import refresh_goal, refresh_metric

    goal_ids = list(goals.values_list("id", flat=True))
    metrics = list(Metric.objects.filter(goal_id__in=goal_ids).select_related("goal"))
    with rollups.batched():
        for metric in metrics:
            if metric.snap_to:
                resnap(metric)
            refresh_metric(metric.id)
        for goal_id in {m.goal_id for m in metrics}:
            refresh_goal(goal_id)
    return len(metrics)


def _zoneless_org_ids() -> list:
    """Orgs with no time zone of their own - their goals count in their owner's."""
    from core_api.registry import endpoint_model

    model = endpoint_model(ORGS_ENDPOINT)
    if model is None or not hasattr(model, "timezone"):
        return []
    return list(model.objects.filter(timezone="").values_list("id", flat=True))


def user_zone_changed(user_id) -> None:
    """The user's own zone changed: their personal goals, and their goals in
    an org with no zone of its own."""
    from goalnexa.models import Goal

    rezone(Goal.objects.filter(Q(org_id__isnull=True) | Q(org_id__in=_zoneless_org_ids()), owner_id=user_id))


def org_zone_changed(org_id) -> None:
    from goalnexa.models import Goal

    rezone(Goal.objects.filter(org_id=org_id))


def _org_model():
    from core_api.registry import endpoint_model

    return endpoint_model(ORGS_ENDPOINT)


def before_org_save(sender, instance, **kwargs) -> None:
    """Remembers an org's zone before a save (connected for every model:
    goalnexa doesn't import platform-org - its model comes from the registry)."""
    if sender is not _org_model() or instance._state.adding or not hasattr(instance, "timezone"):
        return
    instance._goalnexa_old_zone = sender.objects.filter(pk=instance.pk).values_list("timezone", flat=True).first()


def after_org_save(sender, instance, created, **kwargs) -> None:
    if created or sender is not _org_model():
        return
    old = getattr(instance, "_goalnexa_old_zone", None)
    if old is not None and old != instance.timezone:
        org_id = instance.pk
        transaction.on_commit(lambda: org_zone_changed(org_id))
