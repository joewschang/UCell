FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:8121b8c97c9958b7fbf3aca031150599c561c8e5efadc7532e2bad71cac2b4e9 AS original
FROM node:22-alpine AS assemble
COPY --from=original /usr/share/nginx/html /site
COPY --from=original /etc/nginx/conf.d/default.conf /router.conf
COPY . /patch
RUN node /patch/assemble.cjs /site && node /patch/routes.cjs /router.conf
FROM original
COPY --from=assemble /site/ /usr/share/nginx/html/
COPY --from=assemble /router.conf /etc/nginx/conf.d/default.conf
RUN nginx -t
