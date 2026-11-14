FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:2dfd7b927ddbd324f79520cbdeb74624974f7e0c113f9ce13a4848fa9339ebd5
COPY email-scope.cjs /tmp/email-scope.cjs
COPY patch.cjs /tmp/registration-email.cjs
RUN node /tmp/registration-email.cjs

