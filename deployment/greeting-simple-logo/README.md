# UCell generated-photo greeting work

This is a partial renderer/branding implementation, not proof of production release or a daily image-generation service.

- Original AI-generated kitten garden background created with the built-in image tool on 2026-11-15. PNG SHA-256: 70b590ff1ebbdd9ea438e080669c746c62751e732a6d380a7006ca3eb5a20b9e.
- Simplified transparent wordmark is the verified admin asset https://admin.ucell.life/ucell-logo-transparent.png, unmodified.
- QR encodes https://lin.ee/pqS11xX. Both static QR and rendered 1080px output have been decoded.
- Short calendar-aware Traditional Chinese title; a fixed generated background is a fallback only. Daily fresh and varied AI photos still require the separate authorized generation/publishing workflow.
- Existing publication scheduling, manual approval precedence, and archived records remain unchanged.

## Checks completed locally
Four pure renderer TypeScript files type-check. verify.cjs: 7 checks pass. verify-photo.cjs: 7 checks pass; output 1080x1080, 1,948,405 bytes, decoded official LINE destination. Visual review confirmed text, kitten, wordmark and QR clear.
The complete project CI remains authoritative. Prior PR head compiled successfully and passed all greeting suites but unrelated bonus fixture and OpenAPI gates failed. This revision is not yet deployed.

## Production preservation
Current live API has additional overlays including 3 MiB upload input / 5 MiB stored image limits not yet on main. Never replace the whole production app from this branch. patch-live-upload.cjs changes only the legacy appended logo, checks the existing 3 MiB / base64 limits and fails closed on unexpected code. Always re-read the exact current production digest/revision, retain rollback digest, test the candidate and use the normal protected publisher. Do not deploy while required gates remain failed.

## Test tools
The ignored tools directory uses qrcode 1.5.4, pngjs 7.0.0, jsqr 1.4.0. The verify scripts require installed backend TypeScript and runtime dependencies; configure DAILY_GREETING_FONT_PATH to an installed Traditional Chinese font. No credentials are committed.

