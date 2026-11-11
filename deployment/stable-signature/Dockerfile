FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:221405ac2bb6afcb4de620440746f93f7cafa503f99164a7f535daf45ba0a173 AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY patch.cjs signature.css /patch/
RUN node /patch/patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/
