FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:18383d2a4e8660812f1e05499da848bdece8d3f2dab8387c16738b602a5eb0b9
COPY *.js *.cjs migration.sql /app/formal-payout-method-release/
RUN node /app/formal-payout-method-release/install.cjs
