ARG MEMBER_BASE
FROM ${MEMBER_BASE}
WORKDIR /usr/share/nginx/html
COPY base.sha256 /tmp/landscape-signature.sha256
RUN sha256sum -c /tmp/landscape-signature.sha256 && rm /tmp/landscape-signature.sha256
COPY overlay/ ./
RUN nginx -t
