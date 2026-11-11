# Daily greeting artwork v2

This release rotates seven original code-authored vector scenes: landscape, mountains/water, flowers, abstract art, companionship (fictional stylized figures), weather care and festive ribbons/flowers. The renderer produces a fresh dated 1080 x 1080 PNG from these reusable scenes and reviewed Traditional Chinese copy. It does **not** generate a new AI image or retrieve a new photograph every day. No third-party stock image, actual person's likeness, paid image API, new credential or network asset request is used. The existing official UCell logo remains embedded without distortion on an opaque readable panel.

Ordinary Saturdays/Sundays use weekend greetings; verified holidays take precedence. Ordinary dates rotate morning/daytime/care copy. Artwork and text are stable for each released Taipei date, with the existing 07:00 scheduler. Weather scenery is labeled as illustration, not a live forecast. Care text asks readers to check their local forecast; no temperature, rain probability or warning is fabricated. Licensed photos can still be manually uploaded through the existing reviewed admin workflow; this patch does not source them automatically.

Lunar dates remain bounded to the existing reviewed 2026/2027 mapping. Unknown years do not infer lunar festivals. Gregorian/lunar conversion sources rechecked 2026-11-11:
- https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2026e.pdf
- https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2027e.pdf

Renderer version changes to `template-v2-themes` so template idempotency reflects the changed artwork. Existing published/manual images remain immutable and take precedence; deployment does not replace today's approved image. New scenes appear with subsequent scheduled publication. Existing upload review, audit, permission and retry controls stay in force.

Deploy only the changed renderer modules over the current verified API digest, preserving other Codex releases. No schema migration is needed. Use the existing production publisher's expected-revision guard; record rollback digest and public health/image checks. The original working tree must not be overwritten.
