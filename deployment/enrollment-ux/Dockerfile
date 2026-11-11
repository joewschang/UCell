FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:126c985b39a5dff204494e03f5549593bdc4566a9332bcb283e7c22d9380db1f AS original
FROM node:22-alpine AS patch
COPY --from=original /usr/share/nginx/html /site
COPY components.js patch.cjs enrollment.css /patch/
RUN node /patch/patch.cjs /site
FROM original
COPY --from=patch /site/ /usr/share/nginx/html/
