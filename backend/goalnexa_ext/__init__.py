"""GoalNexa's own backend extension on top of the `platform-core` submodule.

This package holds ONLY GoalNexa-specific product code (currently: the
`Goal` entity). Auth, orgs, RBAC, and the generic CRUD factory all come from
`platform-core/backend`, imported as the top-level `app` package — resolved
via `PYTHONPATH`, not copied here (see `../README.md` for why: this project
consumes platform-core as a git submodule "in place" rather than owning a
copy of its code, so platform-core's own fixes/updates stay a plain
`git submodule update` away).

Deliberately NOT named `app` — that name is platform-core's own top-level
package; a second package of the same name in the same Python environment
would collide.
"""
