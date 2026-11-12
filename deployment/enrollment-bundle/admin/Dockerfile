FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:d1215119f92b8a88b468cb7417ac51324a2f6e0468b62c73c7382f74e919d3f7 AS original
FROM node:22-alpine AS build
COPY --from=original /usr/share/nginx/html /site
COPY . /patch
RUN node /patch/assemble.cjs /site /patch
FROM original
COPY --from=build /site/ /usr/share/nginx/html/
RUN nginx -t
