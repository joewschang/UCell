FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:0e6f548e388b359d38344c8e20908e525c9fd80760c1357b4568fd09bccf2f09 AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY deployment/video-card-share/patch.cjs /
RUN node /patch.cjs
FROM live
COPY --from=build /site /usr/share/nginx/html
COPY member/src/video-card.css /usr/share/nginx/html/assets/video-cards-v1.css
