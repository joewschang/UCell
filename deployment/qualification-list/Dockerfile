FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:73df5c1f990be8a7bffb8bbcd3fa9e5e627da4fecd92d33bb6392359e2f99d8e AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/
