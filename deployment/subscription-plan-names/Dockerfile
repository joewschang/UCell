FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:e81901e5ed80b835c0ed0ac56187e4acdba9d6d6c5f4d141b5052caa4df562fc AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM live
COPY --from=build /site /usr/share/nginx/html
