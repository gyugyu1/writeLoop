#!/bin/sh
set -eu

if [ "${RENEWED_LINEAGE:-}" != "/etc/letsencrypt/live/writeloop.kr" ]; then
    exit 0
fi

/usr/bin/docker exec writeLoop-nginx nginx -t
/usr/bin/docker exec writeLoop-nginx nginx -s reload
