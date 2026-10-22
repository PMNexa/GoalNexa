"""Push notifications for the phone apps (`goalnexa.push`, docs/mobile-app.md
"Push protocol"). Plain views like `reminder-settings`: a user only ever
sees their own phones and messages.

- `GET  /api/v1/push/config` - `{enabled, relay_url, server_key}`.
- `GET  /api/v1/push-devices` - the caller's phones.
- `POST /api/v1/push-devices` - `{handle, platform, device_name}`.
- `DELETE /api/v1/push-devices/<id>`.
- `GET  /api/v1/push/messages/<id>` - what one push says.
"""

import uuid

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from goalnexa import push
from goalnexa.models import PushDevice, PushMessage, PushPlatform, ReminderSettings

#: More than any one person has phones; keeps a runaway client from piling rows up.
MAX_DEVICES = 20

_DEVICE = inline_serializer("PushDevice", {
    "id": serializers.UUIDField(),
    "platform": serializers.ChoiceField(choices=PushPlatform.choices),
    "device_name": serializers.CharField(),
    "created_at": serializers.DateTimeField(),
    "last_seen_at": serializers.DateTimeField(),
})


def _device(device: PushDevice) -> dict:
    return {
        "id": str(device.id),
        "platform": device.platform,
        "device_name": device.device_name,
        "created_at": device.created_at.isoformat(),
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
    }


def _uuid(value) -> str | None:
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return None


class PushConfigView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="push_config",
        tags=["push"],
        summary="Push settings for the phone app",
        description=(
            "Where the push relay is and this server's public key, which the app registers its phone with "
            "(`POST <relay_url>/register`). `enabled` is false when this server has push turned off."
        ),
        responses={200: inline_serializer("PushConfig", {
            "enabled": serializers.BooleanField(),
            "relay_url": serializers.CharField(),
            "server_key": serializers.CharField(help_text="Ed25519 public key, base64url without padding."),
        })},
    )
    def get(self, request):
        return Response({"enabled": push.enabled(), "relay_url": push.relay_url(), "server_key": push.server_key()})


class PushDeviceListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="push_devices_list",
        tags=["push"],
        summary="The caller's phones",
        responses={200: inline_serializer("PushDeviceList", {
            "items": _DEVICE.__class__(many=True), "total": serializers.IntegerField(),
        })},
    )
    def get(self, request):
        items = [_device(d) for d in PushDevice.objects.filter(user_id=request.user.id)]
        return Response({"items": items, "total": len(items)})

    @extend_schema(
        operation_id="push_devices_create",
        tags=["push"],
        summary="Register a phone for push",
        description=(
            "`handle` is what the push relay returned for this phone. The same handle again updates it "
            "(200) - from another account too, so a phone that changed accounts follows the new one. "
            "Creates the caller's reminder settings if they had none, so reminders start."
        ),
        request=inline_serializer("PushDeviceCreate", {
            "handle": serializers.CharField(max_length=128),
            "platform": serializers.ChoiceField(choices=PushPlatform.choices),
            "device_name": serializers.CharField(max_length=128, required=False),
        }),
        responses={200: _DEVICE, 201: _DEVICE},
    )
    def post(self, request):
        handle = request.data.get("handle")
        if not isinstance(handle, str) or not handle.strip() or len(handle) > 128:
            raise ValidationError({"handle": ["The handle the push relay returned."]})
        platform = request.data.get("platform", PushPlatform.ANDROID)
        if platform not in PushPlatform.values:
            raise ValidationError({"platform": [f"One of: {', '.join(PushPlatform.values)}."]})
        device_name = str(request.data.get("device_name") or "")[:128]
        now = timezone.now()
        device = PushDevice.objects.filter(handle=handle.strip()).first()
        if device is None:
            if PushDevice.objects.filter(user_id=request.user.id).count() >= MAX_DEVICES:
                # The one not seen for longest makes room.
                PushDevice.objects.filter(user_id=request.user.id).order_by("last_seen_at").first().delete()
            device = PushDevice.objects.create(
                user_id=request.user.id, handle=handle.strip(), platform=platform, device_name=device_name
            )
            status = 201
        else:
            device.user_id, device.platform, device.last_seen_at = request.user.id, platform, now
            device.device_name = device_name or device.device_name
            device.save(update_fields=["user_id", "platform", "device_name", "last_seen_at", "updated_at"])
            status = 200
        ReminderSettings.objects.get_or_create(user_id=request.user.id)
        return Response(_device(device), status=status)


class PushDeviceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="push_devices_delete",
        tags=["push"],
        summary="Stop pushing to a phone",
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH, description="The device's id.")],
        responses={204: None},
    )
    def delete(self, request, pk):
        device = PushDevice.objects.filter(id=_uuid(pk), user_id=request.user.id).first()
        if device is None:
            raise NotFound()
        handle = device.handle
        device.delete()
        push.revoke([handle])
        return Response(status=204)


class PushMessageView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="push_messages_get",
        tags=["push"],
        summary="What one push says",
        description="The app fetches this when a push with this id arrives, and shows `title` and `body`.",
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH, description="The id the push carried.")],
        responses={200: inline_serializer("PushMessage", {
            "id": serializers.UUIDField(),
            "kind": serializers.CharField(),
            "title": serializers.CharField(),
            "body": serializers.CharField(),
            "created_at": serializers.DateTimeField(),
        })},
    )
    def get(self, request, pk):
        message = PushMessage.objects.filter(id=_uuid(pk), user_id=request.user.id).first()
        if message is None:
            raise NotFound()
        return Response({
            "id": str(message.id),
            "kind": message.kind,
            "title": message.title,
            "body": message.body,
            "created_at": message.created_at.isoformat(),
        })
