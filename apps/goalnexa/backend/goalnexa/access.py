"""Which goals a caller may see: their personal goals (no org), plus every
goal filed under an org they belong to - an org's goals belong to its
members, so leaving the org ends access even to goals you created there.
Which orgs those are is platform-org's call, asked through core's
registry (`visible_rows`) rather than by importing its models; with no
orgs endpoint in the host, goals stay owner-only."""

from django.db.models import Q

from core_api.viewsets import visible_rows

ORGS_ENDPOINT = "/api/v1/orgs"


def visible_goals(request, path: str = "") -> Q:
    """A filter for goals the caller may see - `path` is the lookup from
    the queried model to its goal (`"goal__"` for metrics)."""
    own = Q(**{f"{path}owner_id": request.user.id})
    orgs = visible_rows(ORGS_ENDPOINT, request)
    if orgs is None:
        return own
    return (own & Q(**{f"{path}org_id__isnull": True})) | Q(**{f"{path}org_id__in": orgs.values("id")})
