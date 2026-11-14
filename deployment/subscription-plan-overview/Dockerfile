FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:0228e6aab7818ca78ba42a058eb29217e5c238eb091d4fe3e72c7f162b0868e9 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM live
COPY --from=build /site /usr/share/nginx/html

