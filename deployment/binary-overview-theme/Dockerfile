FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:84f606da3a18c445aea94f59c37dfa2493fdf109ac91afb36488c6869984a5ec AS original
FROM node:22-alpine AS assemble
COPY --from=original /usr/share/nginx/html /site
COPY . /patch
RUN node /patch/assemble.cjs /site
FROM original
COPY --from=assemble /site/ /usr/share/nginx/html/
RUN nginx -t
