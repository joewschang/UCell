FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:905491d9be7b44c0b8f0c87388a5dc93f94387dbf6b5864d55a0987b8795fb11
COPY base-hashes.json check.cjs /tmp/directory-release/
RUN node /tmp/directory-release/check.cjs base
COPY dist/ /app/apps/api/dist/
RUN node /tmp/directory-release/check.cjs routes
