FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:813733a516347c8b682607158375416cf5cc8297c2cabc049d913d9c7848ed2a
COPY output/assets/ /usr/share/nginx/html/assets/
COPY output/greetings/ /usr/share/nginx/html/greetings/
COPY output/index.html /usr/share/nginx/html/index.html
COPY output/default.conf /etc/nginx/conf.d/default.conf
RUN nginx -t
