FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:eaf1c8ea50aa526e4c5d44673aee7d52571bed643093e1c440c8fecc3cdf8215 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site && node --check /site/assets/admin-staff-*.js
FROM live
COPY --from=build /site /usr/share/nginx/html
COPY panel.mjs /usr/share/nginx/html/assets/staff-accounts-panel.js
