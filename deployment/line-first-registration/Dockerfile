FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:cda552536dd61c4bdc36f8b35d9282805898d702116406c060b7db2091ed55d5 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM live
COPY --from=build /site /usr/share/nginx/html
