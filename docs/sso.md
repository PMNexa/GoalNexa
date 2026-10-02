# Single sign-on (OpenID Connect)

GoalNexa can sign people in through one OpenID Connect provider - Google,
Authentik, Keycloak, Microsoft Entra ID, Okta, or anything else that
publishes `/.well-known/openid-configuration`. The login and signup pages
then show "Sign in with <label>" next to (or instead of) the password
form.

## Set it up

1. **At the provider**, create an OAuth / OpenID Connect client (a "web
   application", confidential) with this redirect URI:

   ```
   https://<your GoalNexa address>/api/v1/auth/sso/callback
   ```

   Scopes: `openid email profile`. Note the client ID, the client secret
   and the issuer URL (the part before `/.well-known/openid-configuration`).

2. **In `.env`**:

   ```sh
   OIDC_ISSUER=https://accounts.google.com
   OIDC_CLIENT_ID=...
   OIDC_CLIENT_SECRET=...
   OIDC_LABEL=Google          # the button: "Sign in with Google"
   ```

   Then recreate the backend (`docker compose up -d main-backend`, or
   `backend` with `docker-compose.prod.yml`). System > Settings shows the
   issuer and whether the secret is set.

| Provider | `OIDC_ISSUER` |
| --- | --- |
| Google | `https://accounts.google.com` |
| Microsoft Entra ID | `https://login.microsoftonline.com/<tenant id>/v2.0` (and `OIDC_TRUST_EMAIL=true`) |
| Authentik | `https://<authentik>/application/o/<application slug>/` |
| Keycloak | `https://<keycloak>/realms/<realm>` |
| Okta | `https://<org>.okta.com` |

Optional keys: `OIDC_SCOPES` (default `openid email profile`),
`OIDC_REDIRECT_URI` (only if the address Django sees isn't the public
one), `OIDC_TRUST_EMAIL` (below).

## Who gets in

- **Signed in this way before**: the same account. The link is the
  provider's own id for the person, so a changed email there doesn't
  matter.
- **An account with the provider's email already exists**: it is linked
  and signed in - but only if the provider says the email is verified.
  The password keeps working too.
- **Nobody yet**: a new account (no password), under the same rules as
  the signup form: "Who can sign up" (closed = refused; invited people
  only = needs a pending organization invitation) and "Allowed email
  domains". It gets the default role, like any signup.
- The **first account** is still made by first-run setup, with a
  password; it becomes the admin. Sign in with SSO afterwards and it
  links by email.

A provider that sends no `email_verified` claim (Entra ID) is refused
unless `OIDC_TRUST_EMAIL=true` - set it only for a provider whose email
addresses you control, since anyone who can put an address there can
sign in as the account with that address.

A disabled account is refused. A lock from wrong passwords doesn't apply
to single sign-on.

## SSO only

System > Settings > "Allow email + password login" off (or
`AUTH_PASSWORD_LOGIN=false`): the password form, signup form and
password reset are refused; the pages show only the SSO button. It only
applies while SSO is configured.

If the provider breaks and nobody can get in: set
`AUTH_PASSWORD_LOGIN=true` in `.env` and recreate the backend - the
environment overrides the saved setting.

## Troubleshooting

A failed sign-in returns to the login page with a short message; the
reason is in the backend log (`SSO sign-in failed (...)`).

| Message / log | Cause |
| --- | --- |
| "can't be reached" / `provider_unreachable` | `OIDC_ISSUER` wrong, or the backend container can't reach it |
| `provider_misconfigured` | the issuer in the provider's discovery document isn't exactly `OIDC_ISSUER` (check a trailing path) |
| `exchange_failed` | wrong client secret, or the redirect URI isn't registered exactly as above (http vs https, port) |
| `invalid_token` | client ID mismatch, or the server's clock is off by more than a minute |
| "took too long or was started in another browser" | cookies blocked, or more than 10 minutes at the provider |
| "isn't verified with the sign-in provider" | see `OIDC_TRUST_EMAIL` above |

Behind a proxy the redirect URI is built from the forwarded host and
scheme (`X-Forwarded-Proto`); if it comes out wrong, set
`OIDC_REDIRECT_URI`.
