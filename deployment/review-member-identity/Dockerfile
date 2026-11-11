FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:d03a7f6ab35f888700fc7335001c3cc56f3f58fdba3b56f0bba3d011a645f3a7
COPY review.cjs /app/apps/api/dist/modules/member/
COPY patch.cjs /tmp/review-patch.cjs
RUN node /tmp/review-patch.cjs && node --check /app/apps/api/dist/modules/member/formal-member-application.service.js && node --check /app/apps/api/dist/modules/member/formal-kyc-document.service.js
