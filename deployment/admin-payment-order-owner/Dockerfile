FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:6387b94535570834a6f101d0d79db9a83ce50f1dc4c70f0b0858804189ca5f50 AS original
FROM node:22-alpine AS build
COPY --from=original /usr/share/nginx/html /usr/share/nginx/html
COPY patch.cjs /tmp/patch.cjs
RUN node /tmp/patch.cjs
FROM original
COPY --from=build /usr/share/nginx/html/ /usr/share/nginx/html/
