FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:a0015691bef5e12cbe66db51982c46c4f33ba62072e757ecae12b879913c08a1
RUN sed -i '/server_name _;/a\ location = /index.html { expires -1; try_files $uri =404; }' /etc/nginx/conf.d/default.conf && nginx -t
