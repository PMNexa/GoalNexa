from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from goalnexa.models.metric import CheckInCadence, CountDays, MetricAggregation, OnePer, ProgressBy, TargetPer


class RollupRule(models.TextChoices):
    """How a template metric adds up across teams (`goalnexa.rollups`)."""

    SUM = "sum", "Sum - add the teams' numbers up"
    AVG = "avg", "Average - the teams' mean"
    MIN = "min", "Lowest - the team furthest behind, in %"
    NONE = "none", "Not rolled up"


class GoalTemplate(TimestampedModel):
    """One goal system that several teams of an org run - its goals,
    sub-goals and metrics (the SHAPE), with each team's instance holding
    its own targets and check-ins (`goalnexa.templates`). Only the org's
    owners and admins change it; every change is pushed to every instance.
    `org_id` is a bare id, like `Goal.org_id`. Design:
    docs/team-templates.md."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    org_id = models.UUIDField()
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    owner_id = models.UUIDField()

    class Meta:
        db_table = "goal_template"
        verbose_name = "goal template"


class TemplateGoal(TimestampedModel):
    """A goal of a template - its root (`parent` null) or a sub-goal. Each
    team's instance has one `Goal` per template goal (`Goal.template_goal`)."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    template = models.ForeignKey(GoalTemplate, on_delete=models.CASCADE, db_column="template_id", related_name="goals")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, db_column="parent_id", related_name="sub_goals"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    position = models.PositiveIntegerField(default=0, db_default=0)

    class Meta:
        db_table = "template_goal"
        verbose_name = "template goal"


class TemplateMetric(TimestampedModel):
    """A metric of a template goal: what every instance measures (name,
    unit, how check-ins add up, schedule) and how teams roll up
    (`rollup`). `default_base`/`default_target` are what a new instance
    starts with - a blank target makes it tracked only until the team sets
    one. Each instance metric links back with `Metric.template_metric`."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    template_goal = models.ForeignKey(
        TemplateGoal, on_delete=models.CASCADE, db_column="template_goal_id", related_name="metrics"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, db_column="parent_id", related_name="sub_metrics"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=32, blank=True, default="")
    aggregation = models.CharField(
        "each check-in is", max_length=16, choices=MetricAggregation.choices, default=MetricAggregation.LATEST
    )
    check_in_every = models.CharField(max_length=16, choices=CheckInCadence.choices, default=CheckInCadence.NONE, blank=True)
    rollup = models.CharField(max_length=8, choices=RollupRule.choices, default=RollupRule.SUM)
    target_per = models.CharField(
        "target is for", max_length=8, choices=TargetPer.choices, default=TargetPer.WHOLE, db_default=TargetPer.WHOLE,
        blank=True,
    )
    count_days = models.CharField(max_length=8, choices=CountDays.choices, default=CountDays.ALL, db_default=CountDays.ALL)
    progress_by = models.CharField(
        max_length=8, choices=ProgressBy.choices, default=ProgressBy.TOTAL, db_default=ProgressBy.TOTAL
    )
    one_per = models.CharField(
        "one reading per", max_length=8, choices=OnePer.choices, default=OnePer.EVERY, db_default=OnePer.EVERY,
        blank=True,
    )
    default_base = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    default_target = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    position = models.PositiveIntegerField(default=0, db_default=0)

    class Meta:
        db_table = "template_metric"
        verbose_name = "template metric"
