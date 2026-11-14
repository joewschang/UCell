FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:40fe9a2a81ba6aca9e7dfa5a639a5b61b250c8251c7b489de23d54f79ed8fcce
COPY policy.cjs /app/apps/api/dist/modules/member/signature-reuse.cjs
COPY patch.cjs /tmp/patch-signature-reuse.cjs
RUN node /tmp/patch-signature-reuse.cjs && node --check /app/apps/api/dist/modules/member/formal-member-application.service.js
