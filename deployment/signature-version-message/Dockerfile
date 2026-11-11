FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:fb9774f5e259655796671d99ee0f970608575e33d61fb7b2562665f08a95612b AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/

