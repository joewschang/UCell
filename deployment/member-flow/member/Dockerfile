FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:20c31fba7b6d574bd77c5fc0c02439d1c319f9d712607dfcdcd93fcd9cd6224e AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site && node --check /site/assets/member-flow-v1-*.js
FROM live
COPY --from=build /site /usr/share/nginx/html
COPY topics.mjs /usr/share/nginx/html/assets/member-flow-v1-topics.js
COPY crop.mjs /usr/share/nginx/html/assets/member-flow-v1-crop.js
COPY crop.css /usr/share/nginx/html/assets/member-flow-v1-crop.css

