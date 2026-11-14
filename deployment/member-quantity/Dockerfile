FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:9e3f35bd93b32c3044447bb12dffb36d19f99704052e7b65bdb11fc93a99867f AS live
FROM node:22-alpine AS build
COPY --from=live /usr/share/nginx/html /site
COPY patch.cjs /patch.cjs
RUN node /patch.cjs /site
FROM live
COPY --from=build /site /usr/share/nginx/html

COPY quantity.css /usr/share/nginx/html/assets/member-quantity-v1.css
