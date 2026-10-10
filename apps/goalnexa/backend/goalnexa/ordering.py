"""Manual order of goals and metrics among their siblings (`position`).

Siblings: sub-goals of one goal; top-level goals of one org, or one
owner's personal goals; metrics of one goal under the same parent metric.
A new row goes last; `POST <resource>/reorder` (drag and drop) renumbers
a sibling group.
"""

import uuid

from django.db import transaction
from django.db.models import Max
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from goalnexa.models import Goal, Metric

#: More ids than any real sibling group - a cap on one request's writes.
MAX_REORDER = 500


def goal_siblings(goal):
    if goal.parent_id:
        return Goal.objects.filter(parent_id=goal.parent_id)
    if goal.org_id:
        return Goal.objects.filter(parent__isnull=True, org_id=goal.org_id)
    return Goal.objects.filter(parent__isnull=True, org_id__isnull=True, owner_id=goal.owner_id)


def metric_siblings(metric):
    return Metric.objects.filter(goal_id=metric.goal_id, parent_id=metric.parent_id)


def sibling_key(row) -> tuple:
    if isinstance(row, Goal):
        if row.parent_id:
            return ("parent", row.parent_id)
        return ("org", row.org_id) if row.org_id else ("owner", row.owner_id)
    return (row.goal_id, row.parent_id)


def siblings(row):
    return goal_siblings(row) if isinstance(row, Goal) else metric_siblings(row)


def next_position(row) -> int:
    """Last place among `row`'s siblings (not counting `row` itself)."""
    top = siblings(row).exclude(pk=row.pk).aggregate(top=Max("position"))["top"]
    return 0 if top is None else top + 1


class ReorderMixin:
    """`POST <resource>/reorder` with `{"ids": [...]}`: those siblings in
    that order, first to last. Every id must be one the caller may update
    (the access policy reads a custom POST as `update`), all with one
    parent; siblings left out keep their order after them."""

    @extend_schema(
        description="Put siblings in this order, first to last - sub-goals of one goal, an organization's "
        "top-level goals (or your personal ones), or a goal's metrics under one parent metric. Siblings "
        "left out keep their order after them. You need update rights on every one.",
        request=inline_serializer(
            "Reorder",
            {"ids": serializers.ListField(child=serializers.UUIDField(), help_text="Ids of one sibling group, first to last.")},
        ),
        responses={204: None},
    )
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) and i for i in ids):
            raise ValidationError({"ids": ["A list of ids, first to last."]})
        try:
            ids = [uuid.UUID(i) for i in ids]
        except ValueError:
            raise ValidationError({"ids": ["Unknown id."]}) from None
        if len(ids) > MAX_REORDER or len(set(ids)) != len(ids):
            raise ValidationError({"ids": [f"Up to {MAX_REORDER} distinct ids."]})
        rows = list(self.filter_queryset(self.get_queryset()).filter(id__in=ids))
        if len(rows) != len(ids):
            raise ValidationError({"ids": ["Unknown id."]})
        for row in rows:
            self.check_object_permissions(request, row)
        if len({sibling_key(row) for row in rows}) > 1:
            raise ValidationError({"ids": ["Only items with the same parent can be reordered together."]})
        listed = set(ids)
        rest = [pk for pk in siblings(rows[0]).order_by("position", "created_at").values_list("pk", flat=True) if pk not in listed]
        model = type(rows[0])
        with transaction.atomic():
            for position, pk in enumerate([*ids, *rest]):
                model.objects.filter(pk=pk).update(position=position)
        return Response(status=204)
