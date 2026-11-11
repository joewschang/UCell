FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:3e10b4cb79678d5c482438bf9ca9c27e82c723b4b0f81fa1ab4ecc16e3c46067 AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY patch.cjs grip.css /patch/
RUN node /patch/patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/
