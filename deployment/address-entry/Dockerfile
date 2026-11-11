FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:69597e0c7fd2721a987529b2a182c5a4ec2282e2aa5e1636d6ae6e6a49ec1f12 AS baseline
FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:054f2681c68f887f7f798eb5586fa3b22f4bdd045649807bc3a7a163763f3482 AS build
WORKDIR /tmp/address
COPY --from=baseline /usr/share/nginx/html/index.html dist/index.html
COPY --from=baseline /usr/share/nginx/html/assets/enrollment-reader-03ef491b1d54.js dist/assets/enrollment-reader-03ef491b1d54.js
COPY patch.cjs ./
RUN node patch.cjs dist
FROM baseline
COPY --from=build /tmp/address/dist/ /usr/share/nginx/html/
