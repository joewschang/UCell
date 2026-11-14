FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:fb608422d89190d6ca616cb44ca0efd74e31f0747b60faeeeeb8056c88d048c5
COPY staff.cjs /app/apps/api/dist/modules/auth/staff.cjs
COPY member-scope.cjs /app/apps/api/dist/modules/person/member-scope.cjs
COPY patch.cjs /tmp/staff-accounts.cjs
RUN node /tmp/staff-accounts.cjs
