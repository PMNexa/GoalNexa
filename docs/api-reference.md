# API reference (OpenAPI)

GoalNexa describes its REST API as an [OpenAPI 3](https://spec.openapis.org/oas/v3.0.3)
document, generated from the code on every request, so it can't drift from
what the server actually does. This page is in two parts: [using the
reference](#using-the-reference), for anyone calling the API, and
[documenting a module](#documenting-a-module), for anyone adding endpoints.

## Using the reference

Every instance serves:

| URL | What |
|---|---|
| `/api/v1/docs` | Swagger UI - browse and try every endpoint |
| `/api/v1/redoc` | Redoc - the same, as one long reading page |
| `/api/v1/schema` | The OpenAPI document (YAML; `?format=json` for JSON) |

All three are public; each operation still needs its own credentials.

**Signing in.** `POST /api/v1/auth/login` with `{"email", "password"}`
returns an `access_token` (15 minutes). Send it as
`Authorization: Bearer <token>`; in Swagger UI, paste it into
**Authorize** (`bearerAuth`). Other schemes in the document: the MCP
tokens (`/api/v1/mcp` only) and a metric's ingest token (its `ingest`
endpoint only).

**Conventions every resource shares** (orgs, goals, metrics, check-ins,
cycles, ...):

- **Lists** return `{items, total, page, page_size}`. `?page=`,
  `?page_size=` (max 100), `?sort=field` / `?sort=-field`, `?q=` (search,
  where the resource has it).
- **Filters**: `?filter{field}=value` (exact), `?filter{field.icontains}=`,
  `.gt` `.gte` `.lt` `.lte` `.contains`, `.isnull=true`, `.in=a,b,c`;
  `?filter{-field}=` excludes; `.` follows a relation
  (`?filter{goal.org_id}=...`). Each list operation names its fields.
- **Relations** come back as ids. Name one in `?include[]=` for the full
  object instead (`/api/v1/metrics?include[]=goal`); some fields (a goal's
  `metrics`) only appear when included. `?exclude[]=` drops fields.
- **Errors** are `{code, message, field_errors}` - `field_errors` maps a
  request field to its messages when validation failed.
- **`GET /api/v1/<resource>/schema`** describes a resource's fields for
  building forms; the OpenAPI document is the one to generate clients
  from.

**Generating a client**: any OpenAPI 3 tool works, e.g.
`npx openapi-typescript https://<host>/api/v1/schema -o api.d.ts` for
TypeScript types, or [openapi-generator](https://openapi-generator.tech)
for a full SDK.

**AI assistants** don't need this: they use the MCP server
(`/api/v1/mcp`, see `apps/platform-mcp/README.md`), which describes its
own tools.

## Documenting a module

### How it's built

- [drf-spectacular](https://drf-spectacular.readthedocs.io) generates the
  document. It's a dependency of `platform-core-backend`, so every module
  can import it.
- `platform-core`'s `core_api/openapi.py` (`PlatformAutoSchema`) adds what
  spectacular can't see on its own: the `include[]`/`exclude[]`/`filter{}`
  parameters, the list envelope, relation fields, the generic actions,
  the error responses.
- Each module describes its own authentication classes (below).
- The host, `apps/main`, turns it on (`REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"]`,
  `SPECTACULAR_SETTINGS` in `config/settings.py`) and mounts the three
  URLs (`config/urls.py`). The pages' JS/CSS comes from
  `drf-spectacular-sidecar`, served from `/static/`.

### A `BaseViewSet` resource: nothing to write

A `BaseViewSet` + `BaseSerializer` pair is documented automatically: list,
retrieve, create, update, delete, `schema`, link/unlink, every field, the
query parameters and the errors. What makes it read well:

- **`help_text`** on model or serializer fields - it becomes the field's
  description (`extra_kwargs = {"source": {"help_text": "..."}}`).
- **`verbose_name` / `verbose_name_plural`** on the model - the generated
  operation descriptions use them ("The check-ins the caller can see").
- **Choices** as a `TextChoices` class - they become an enum. Two fields
  sharing one choice set under different names (a goal's `health` and a
  score's `final_health`) need one entry in main's
  `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]`; the test below fails
  until it's there.

The viewset's class docstring and the docstrings of the generic actions
are **not** shown - they're notes for developers, and the generic
operations get a generated one-liner instead.

### A custom `@action`

Its docstring is its description - write it for someone calling the API,
not for someone reading the code. Declare what goes in and out unless the
viewset's own serializer already is that:

```python
# goalnexa/ordering.py - shared by goals and metrics
@extend_schema(
    description="Put siblings in this order, first to last - ...",
    request=inline_serializer("Reorder", {"ids": serializers.ListField(child=serializers.UUIDField(), help_text="...")}),
    responses={204: None},
)
@action(detail=False, methods=["post"])
def reorder(self, request):
```

`description` in `@extend_schema` wins over the docstring - handy when the
docstring is worth keeping for developers.

Never name an action method `schema`: it shadows DRF's `APIView.schema`
(the view's OpenAPI generator) and the whole document fails. platform-core's
own `schema` action is the method `resource_schema` with `url_path="schema"`.

### A plain `APIView`

Spectacular can't read a plain `APIView`'s body: until it's annotated it
shows up with its docstring and free-form JSON. Annotate it with
`@extend_schema` on each method. The reference is goalnexa's
`MetricIngestView` (`apps/goalnexa/backend/goalnexa/views/ingest.py`):

```python
@extend_schema(
    operation_id="metrics_ingest",
    tags=["metrics"],
    summary="Check in with a metric's ingest token",
    description="For scripts, cron jobs and webhooks: ...",
    parameters=[
        OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH, description="The metric's id."),
        OpenApiParameter("token", str, OpenApiParameter.QUERY, required=False, description="..."),
    ],
    request=inline_serializer("MetricIngest", {"value": serializers.DecimalField(...), ...}),
    responses={201: inline_serializer("MetricIngestResponse", {...})},
    examples=[OpenApiExample("Nightly job", value={"value": 42, "note": "nightly job"}, request_only=True)],
)
def post(self, request, pk):
```

- **Reuse a real serializer** when the view already validates with one
  (`request=LoginSerializer`); `inline_serializer` is for bodies that
  have none.
- **Component names are global** across all modules. Name inline
  serializers after the operation (`MetricIngest`, `OrgInvitationAccept`),
  not `Request`/`Response`. Request components get a `Request` suffix
  automatically, so don't add one (`MetricIngest` becomes
  `MetricIngestRequest`).
- **Path parameters**: a `<pk>` in the URL is shown as `{id}`. Describe it
  as `OpenApiParameter("id", ...)`; a parameter named `pk` would appear
  twice.
- **`tags`**: by default the first path segment after `/api/v1/` (`auth`,
  `metrics`). Set it when that's the wrong group.
- **`operation_id`**: generated clients use it as the method name, so
  keep it stable: `<resource>_<verb>`.
- **Hide** an endpoint that isn't for API users (an OAuth redirect, an
  internal callback) with `@extend_schema(exclude=True)`.

### Authentication

A module describes its **own** authentication classes in `<module>/openapi.py`,
imported from its `AppConfig.ready()` (an extension registers itself on
import). platform-auth's `ActorAuthentication` is the reference:

```python
# platform_auth/openapi.py
from drf_spectacular.extensions import OpenApiAuthenticationExtension

class ActorAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "platform_auth.authentication.ActorAuthentication"  # a dotted string: no import
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "..."}
```

```python
# platform_auth/apps.py
def ready(self):
    from platform_auth import openapi  # noqa: F401 - registers its OpenAPI auth scheme
```

A view that checks a credential itself, with no authentication class
(`authentication_classes = []`), declares its scheme on the view instead
(`core_api.openapi`):

```python
class MetricIngestView(APIView):
    authentication_classes = []
    openapi_auth = {"metricIngestToken": {"type": "http", "scheme": "bearer", "description": "..."}}
```

### Error responses

Every operation gets `Error` responses guessed from the view: 400 for a
request body or a list, 401/403 when it needs authentication, 404 when the
path has an id, 429 when it's throttled. A view whose answers differ sets
`openapi_errors`, e.g. `MetricIngestView`'s `("400", "401", "429")` (an
unknown metric is a 401 too). Raise `core_api.errors` classes (or DRF's
exceptions) so the body really is the `Error` shape.

### Checking your work

```sh
# in the main-backend container
cd /apps/main/backend
.venv/bin/python manage.py spectacular --validate --fail-on-warn --file /tmp/openapi.yaml
.venv/bin/python manage.py test tests.test_openapi
```

`tests/test_openapi.py` runs the same generation with `--fail-on-warn` in
CI. It fails if a view can't be described: an authentication class with
no extension, an unresolvable field, two names for one enum. Then open
`/api/v1/docs` and read your endpoints as a caller would.

A module's own standalone test settings don't need any of this: nothing
generates a document there, and `@extend_schema` is a no-op until
something does.

### Coverage today

Every `BaseViewSet` resource is fully described, and so is `MetricIngestView`.
The other plain views are still docstring + free-form JSON:

- platform-auth: login, signup, setup, refresh, logout, me, password reset
  and verification, SSO, exports.
- platform-org: invitations by token, accept/decline.
- goalnexa: reminder settings, dashboard shares, onboarding choice.
- platform-mcp: tokens, grants, the OAuth endpoints.

Annotate them module by module, as above.
