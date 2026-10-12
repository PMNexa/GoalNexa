from rest_framework import serializers

from core_api.serializers import BaseSerializer
from goalnexa.models import GoalTemplate, TemplateGoal, TemplateMetric
from goalnexa.serializers.metric import validate_one_per


class GoalTemplateSerializer(BaseSerializer):
    """`/api/v1/goal-templates` - one goal system for several teams of an
    org (docs/team-templates.md). Its goals are a generic tab on its page;
    applying it to teams, the team board and targets are custom actions
    (`GoalTemplateViewSet`). `org_id` is a cross-module id, like
    `Goal.org_id`; `owner_id` is the creator."""

    class Meta:
        model = GoalTemplate
        auto_exclude = ["created_at", "updated_at"]
        display_field = "title"
        extra_kwargs = {
            "title": {"help_text": "A name for the goal system. For example: Sales targets."},
            "description": {"help_text": "Optional. What it's for, and how teams should use it."},
            "org_id": {"label": "Organization", "help_text": "The organization whose teams run it. Only its owners and admins change the template."},
            "owner_id": {"read_only": True},
        }
        related_endpoints = {"org_id": "/api/v1/orgs"}


class TemplateGoalSerializer(BaseSerializer):
    """`/api/v1/template-goals` - a goal of a template (its root, or a
    sub-goal with `parent`). Every team's instance has a goal following
    it; a change is pushed to all of them."""

    class Meta:
        model = TemplateGoal
        auto_exclude = ["created_at", "updated_at", "instances"]
        display_field = "title"
        extra_kwargs = {
            "title": {"help_text": "The goal, as an outcome. Every team's copy gets this title."},
            "description": {"help_text": "Optional. Why it matters."},
            "template": {"help_text": "The goal template it belongs to."},
            "parent": {"help_text": "Makes it a sub-goal of another goal of the same template."},
            "position": {"help_text": "Order among goals with the same parent, lowest first."},
        }


class TemplateMetricSerializer(BaseSerializer):
    """`/api/v1/template-metrics` - a metric every team's instance tracks.
    `rollup` says how the teams add up into their totals;
    `default_base`/`default_target` are what a new instance starts with
    (no target = tracked only until the team sets one). `aggregation`
    can't change once a team has checked in."""

    class Meta:
        model = TemplateMetric
        auto_exclude = ["created_at", "updated_at", "instances"]
        display_field = "name"
        extra_kwargs = {
            "name": {"help_text": "The number every team tracks. For example: Revenue, or Deals closed."},
            "description": {"help_text": "Optional. How it is measured."},
            "unit": {"help_text": "What the number counts, such as $, deals or %."},
            "aggregation": {"help_text": "Latest: each check-in is the new reading. Sum: each check-in is an amount added. Can't change once a team has checked in."},
            "check_in_every": {"help_text": "How often teams should check in. Empty = no schedule."},
            "rollup": {"help_text": "How the teams add up into a department's and the organization's total."},
            "default_base": {"help_text": "Where a new team instance starts."},
            "default_target": {"help_text": "A new team instance's target. Empty = each team sets its own (until then, it doesn't count)."},
            "template_goal": {"help_text": "The template goal it measures."},
            "parent": {"help_text": "Makes it a sub-metric breaking down another metric of the same goal."},
            "position": {"help_text": "Order among metrics with the same parent, lowest first."},
            "target_per": {"help_text": "The whole goal, or each day/week/month/quarter/year (a quota, for amounts to add). Every team's copy follows it."},
            "count_days": {"help_text": "For a target per day or week: every day, or weekdays only."},
            "one_per": {"help_text": "Which check-ins count: every one, or only the last one each day/week/month/quarter/year (a later one replaces the earlier). Every team's copy follows it."},
            "progress_by": {"help_text": "For a target per period: the total, or how often the target is hit (totals then average the teams or take the lowest)."},
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        target_per = attrs.get("target_per", getattr(instance, "target_per", ""))
        aggregation = attrs.get("aggregation", getattr(instance, "aggregation", "latest"))
        progress_by = attrs.get("progress_by", getattr(instance, "progress_by", "total"))
        rollup = attrs.get("rollup", getattr(instance, "rollup", "sum"))
        if target_per and aggregation != "sum":
            raise serializers.ValidationError({"target_per": ["A target per period needs check-ins that are amounts to add (Sum)."]})
        if progress_by == "hit_rate" and not target_per:
            raise serializers.ValidationError({"progress_by": ["How often the target is hit needs a target per period."]})
        if progress_by == "hit_rate" and rollup == "sum":
            raise serializers.ValidationError({"rollup": ["Hit rates don't add up - pick the average or the lowest."]})
        validate_one_per(attrs.get("one_per", getattr(instance, "one_per", "")), target_per)
        return attrs
