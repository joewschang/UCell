FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:8217cee72eee81fec2cf603d05cdc04e549424b023e975501d54ceb76ab0cdec
COPY admin-mobile.css /usr/share/nginx/html/assets/admin-mobile-layout-v1.css
RUN sed -i 's|</head>|<link rel="stylesheet" href="/assets/admin-mobile-layout-v1.css"></head>|' /usr/share/nginx/html/index.html && nginx -t
