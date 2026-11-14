FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:e9e0b13a8954c52154a87daf73a671be7cb9daebae61b8e5bfa78092fc4d70fb
COPY patch.cjs /tmp/independent-registration.cjs
RUN node /tmp/independent-registration.cjs && node --check /app/apps/api/dist/modules/auth/member-web-registration.service.js && node --check /app/apps/api/dist/modules/auth/member-web-auth.service.js
