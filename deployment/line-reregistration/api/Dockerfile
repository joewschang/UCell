FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:00cf6e0fc9977e2916905befb1224e9dd0cfd85818ad6748b1f02bff771649e7
COPY patch.cjs /tmp/patch-line-registration.cjs
RUN node /tmp/patch-line-registration.cjs && node --check /app/apps/api/dist/modules/auth/member-web-registration.service.js
