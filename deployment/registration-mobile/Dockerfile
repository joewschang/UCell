FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:98046c29e1d0af3dd87c7ad547b33a31f8bcb67b47fbfd083c4c29fb1233712b
COPY mobile.cjs /app/apps/api/dist/modules/auth/registration-mobile.cjs
COPY patch.cjs /tmp/registration-mobile.cjs
RUN node /tmp/registration-mobile.cjs
