import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Ship the whole route manifest up front instead of discovering routes
  // lazily. platform-core's generic detail page resolves where ANOTHER
  // resource is mounted (e.g. orgs at platform-org/orgs) from this
  // manifest, to link related rows - with lazy discovery the client
  // would only know the routes matched so far.
  routeDiscovery: { mode: "initial" },
} satisfies Config;
