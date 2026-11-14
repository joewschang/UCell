FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:f01ab88ebdf2ec3f21bba2ec763e0a0365e6bd5a9cba5078444257a7b7625c79 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site && node --check /site/assets/member-password-*.js
FROM live
COPY --from=build /site /usr/share/nginx/html
COPY form.mjs /usr/share/nginx/html/assets/first-password-v1.js
