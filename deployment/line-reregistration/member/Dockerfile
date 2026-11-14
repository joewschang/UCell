FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:ed8dcbffb38af1aa42f6d0ce37db0bd056dc7024e8365bf7fb9f6b2ed9604c68 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site && node --check /site/assets/line-registration-actions*.js
FROM live
COPY --from=build /site /usr/share/nginx/html
