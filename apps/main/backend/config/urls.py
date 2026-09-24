"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    # Same "api/v1/auth/" prefix platform_auth's own standalone
    # config/urls.py uses - keeps its internal cookie path
    # (settings.URL_PREFIX + "/api/v1/auth") and the frontend's already-
    # hardcoded fetch path ("/api/v1/auth/login") correct unmodified.
    # nginx's /api/ location must forward this prefix through unstripped
    # (see nginx/default.conf) to match.
    path('api/v1/auth/', include('platform_auth.urls')),
    # platform-auth's RBAC resources (users, roles, role-assignments,
    # permissions) - at api/v1/ like every other BaseViewSet resource.
    path('api/v1/', include('platform_auth.rbac_urls')),
    # Same "api/v1/" prefix platform_org's own standalone config/urls.py
    # uses (its own urls.py adds "orgs" under this), matching the
    # frontend package's already-hardcoded fetch path ("/api/v1/orgs").
    path('api/v1/', include('platform_org.urls')),
    # Same "api/v1/" prefix goalnexa's own standalone config/urls.py uses
    # (its own urls.py adds "goals"/"metrics"/"check-ins" under this) -
    # distinct resource names from platform_org's "orgs", so sharing the
    # bare prefix doesn't collide.
    path('api/v1/', include('goalnexa.urls')),
    # platform_mcp: the MCP server over every BaseViewSet above (orgs,
    # goals, metrics, check-ins) at api/v1/mcp - each tool call is an
    # internal sub-request to the same API as the caller, so the same
    # scoping applies - plus api/v1/mcp/tokens (personal access tokens,
    # which the MCP endpoint accepts besides a login's access token).
    path('api/v1/', include('platform_mcp.urls')),
]
