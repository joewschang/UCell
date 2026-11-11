FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:5d352f530443a937d9186150d2a7c15065637af8e5e1afc253db75b29636d55c AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/
