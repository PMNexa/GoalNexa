"""Unit tests for the pure helper functions in `app.api.crud_factory`.

No DB, no app boot — just the pagination clamp and sort-param parser.
"""

from app.api.crud_factory import clamp_pagination, parse_sort


def test_clamp_pagination_defaults_pass_through():
    assert clamp_pagination(1, 20) == (1, 20)


def test_clamp_pagination_clamps_page_to_at_least_one():
    assert clamp_pagination(0, 20) == (1, 20)
    assert clamp_pagination(-5, 20) == (1, 20)


def test_clamp_pagination_clamps_page_size_lower_bound():
    assert clamp_pagination(1, 0) == (1, 1)
    assert clamp_pagination(1, -10) == (1, 1)


def test_clamp_pagination_clamps_page_size_upper_bound():
    assert clamp_pagination(1, 500) == (1, 100)
    assert clamp_pagination(1, 500, max_page_size=50) == (1, 50)


def test_parse_sort_returns_none_when_missing():
    assert parse_sort(None, ("status", "created_at")) is None
    assert parse_sort("", ("status", "created_at")) is None


def test_parse_sort_ascending():
    assert parse_sort("status", ("status", "created_at")) == ("status", False)


def test_parse_sort_descending():
    assert parse_sort("-created_at", ("status", "created_at")) == ("created_at", True)


def test_parse_sort_rejects_field_outside_allowlist():
    assert parse_sort("bogus", ("status", "created_at")) is None
    assert parse_sort("-bogus", ("status", "created_at")) is None


def test_parse_sort_rejects_bare_dash():
    assert parse_sort("-", ("status", "created_at")) is None
