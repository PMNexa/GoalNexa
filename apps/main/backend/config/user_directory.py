"""User lookups other modules need from platform-auth - platform-org's
(`PLATFORM_ORG_USER_DIRECTORY`, `PLATFORM_ORG_ACCOUNT_EXISTS`), goalnexa's
(`GOALNEXA_USER_DIRECTORY`, for emailing reminders) - and platform-auth's
own from platform-org (`PLATFORM_AUTH_IS_INVITED`). Main is the one place
that knows the modules, so the glue lives here."""

from platform_auth.models import User


def lookup_users(user_ids) -> dict[str, dict]:
    return {
        str(user_id): {"name": name, "email": email}
        for user_id, name, email in User.objects.filter(id__in=list(user_ids)).values_list("id", "name", "email")
    }


def account_exists(email: str) -> bool:
    return User.objects.filter(email=email.strip().lower()).exists()


def has_pending_invitation(email: str) -> bool:
    """platform-auth's invite-only signup (`PLATFORM_AUTH_IS_INVITED`): an
    email with an open platform-org invitation may sign up."""
    from django.utils import timezone

    from platform_org.models import OrgInvitation, OrgInvitationStatus

    return OrgInvitation.objects.filter(
        email=email.strip().lower(), status=OrgInvitationStatus.PENDING, expires_at__gt=timezone.now()
    ).exists()
