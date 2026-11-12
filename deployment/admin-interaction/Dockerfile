FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:fef3ef3e7474a0ab0d7177318ac6ef731c4988318cb9c4f6ab50199a9e4a45da AS original
FROM node:22-alpine AS build
COPY --from=original /usr/share/nginx/html /site
COPY . /release
RUN node /release/install.cjs /site /release
FROM original
COPY --from=build /site/ /usr/share/nginx/html/
RUN nginx -t
