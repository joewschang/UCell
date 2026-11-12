FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:84ce3080f82e14b4ebe9a4e71ca2f872367c93cb6e04b7127103ab35b03f56d7
COPY sponsor-map.controller.js /app/apps/api/dist/modules/admin-observability/sponsor-map.controller.js
COPY install.cjs verify.cjs /tmp/sponsor-overview/
RUN node /tmp/sponsor-overview/install.cjs && node /tmp/sponsor-overview/verify.cjs
