UCell public website integration — 2026-10-19

Source: C:\UCell\public_html (preserved unchanged).
This directory is the integrated source under version control.

Public product names/prices/availability come from GET /api/public/products.
Only active TIP product catalog entries are exposed by the backend projection.
Existing research pages remain available when a product is not on sale.
No price or purchasable state is guessed if the API is unavailable.

Published upcoming event announcements come from GET /api/public/events.
Drafts, archived/ended events, meeting credentials, attendance and member data
are excluded. Publishing/archiving in the existing admin Events page controls
visibility; the public response cache is at most 30 seconds.

The website Nginx proxies only these two read endpoints to the production API.
It does not proxy admin or authenticated member operations or forward cookies.
Member signup, shopping and event registration use member.ucell.life.
join.html is the public entry; ?mode=register opens the existing registration UI.
LINE friend link: https://lin.ee/pqS11xX (adding a friend does not register a member).

Build: Dockerfile.website at repository deployment/.
Release must preserve existing root/www DNS records until the new origin,
custom hostnames and TLS have been verified. Email/MX records are out of scope.
