# Admin Production Security Headers

The current UCell hosting path may use Apache/cPanel, so `public/.htaccess` provides the first production header baseline:
- CSP
- X-Content-Type-Options
- Referrer-Policy
- X-Frame-Options
- Permissions-Policy
- SPA route fallback

If the Admin frontend later moves to Azure Static Web Apps, Front Door or another reverse proxy, reproduce these headers there instead of relying on `.htaccess`.

The CSP intentionally permits Microsoft login endpoints and denies frames/objects from all other sources.
