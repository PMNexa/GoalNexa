# apps/extensions

Empty here. A downstream build (e.g. the hosted edition) adds its own
Django apps as `apps/extensions/<name>/backend/` (a pip package with a
`pyproject.toml`). The backend image installs every one of them
(`apps/main/backend/Dockerfile`); `GOALNEXA_EXTENSIONS` decides which run,
and `GOALNEXA_EXTENSION_SETTINGS` (a JSON object) carries their settings.
In the dev compose, install one with
`BACKEND_EXTRA_PIP=-e /apps/extensions/<name>/backend`. See root AGENTS.md
("Hosted (SaaS) edition hooks").
