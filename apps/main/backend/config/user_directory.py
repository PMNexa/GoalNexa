"""platform-org's user directory (`PLATFORM_ORG_USER_DIRECTORY`,
`PLATFORM_ORG_ACCOUNT_EXISTS`) - main is the one place that knows both
modules, so the glue lives here."""

from platform_auth.models import User


def lookup_users(user_ids) -> dict[str, dict]:
    return {
        str(user_id): {"name": name, "email": email}
        for user_id, name, email in User.objects.filter(id__in=list(user_ids)).values_list("id", "name", "email")
    }


def account_exists(email: str) -> bool:
    return User.objects.filter(email=email.strip().lower()).exists()
