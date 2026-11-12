FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:b7bec1e5ed474f4ff8678ca138dc2c307c2c5e55f2bc6ee1e773563753d664d7
COPY release/ /app/enrollment-release/
RUN node /app/enrollment-release/apply.cjs && node /app/enrollment-release/smoke.cjs

