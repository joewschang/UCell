FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:55fda82bd486f5e55aecd0577751d48c9d625419cceb53a4976461fea1eaec2e AS original
FROM node:22-alpine AS assemble
COPY --from=original /usr/share/nginx/html /site
COPY . /patch
RUN node /patch/assemble.cjs /site
FROM original
COPY --from=assemble /site/ /usr/share/nginx/html/
RUN nginx -t
