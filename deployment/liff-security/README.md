# LIFF security update — 2026-11-12

Pin `@line/liff` and its lockfile to 2.31.1, the patch for GHSA-wppr-qmp4-w627. Existing login, binding and greeting-sharing flows remain unchanged. No credential, permission or API/database change is needed.

The current production member image has cumulative overlays absent from a plain source build. `prepare.mjs` bundles the exact patched npm SDK, then uses TypeScript symbol analysis to ensure each removed SDK block has only the expected external singleton binding. It replaces the complete old SDK block in the active application and greeting bundle, retaining the surrounding app code exactly. Both import one shared content-fingerprinted SDK; the root HTML points to newly fingerprinted entry files. `nginx-base.conf` is the original production configuration; the generated config preserves security headers and existing proxy routes.

Current HTML stays no-store. New asset filenames avoid previously immutable caches. The former active main URL returns a relative no-store redirect; the former classic greeting script returns a no-store dynamic-import shim so cached HTML remains compatible. 158 other old SDK-bearing historical asset paths return 410; their original bytes remain in the base image for evidence but are no longer served by this revision. Cached/in-memory old tabs cannot be remotely revoked. Tests reproduced an old 2.31.0 tab remaining old until reload, then loading 2.31.1. Ask users to close/reopen the LINE page or reload; device webview cache clearing may be needed if an old version persists. Do not claim all users have upgraded.

Rebuild: install member lockfile, extract the pinned production image's `/usr/share/nginx/html` into `site/`, run `node deployment/liff-security/prepare.mjs`, then build this directory's Dockerfile. `browser-smoke.cjs` tests the candidate at localhost:18086, using Edge and blocking external requests; real SDK loads, while LINE auth/network is mocked. Source tests cover login, token exchange rejection, binding, deep links, sharing success/cancel/fallback. No real LINE messages are sent. Physical iOS/Android LINE login/consent/share selection and disk-cache behavior remain unverified.

Before deployment re-read the live member revision; if it changed, rebuild and verify over the new base. Publish via `deployment/publish-production.ps1` with expected revision. Record actual public SDK version, entry URLs, headers and image digest after release. Reverting to the previous image would reintroduce the vulnerable SDK; prefer a forward fix retaining 2.31.1 if a regression occurs.

Sources checked 2026-11-12:
- https://github.com/line/liff/security/advisories/GHSA-wppr-qmp4-w627
- https://developers.line.biz/en/docs/liff/release-notes/

Affected versions are 2.20.0–2.31.0. The issue involves specially crafted external-browser URLs. LINE plans restrictions around 2026-11-24; update promptly. Presence of an affected SDK does not establish exploitation.
