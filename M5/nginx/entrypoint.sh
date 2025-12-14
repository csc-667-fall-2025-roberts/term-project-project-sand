#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs"
CERT="${CERT_DIR}/fullchain.pem"
KEY="${CERT_DIR}/privkey.pem"

SERVER_NAME="${SERVER_NAME:-localhost}"

mkdir -p "${CERT_DIR}"

if [ ! -f "${CERT}" ] || [ ! -f "${KEY}" ]; then
  echo "Generating self-signed TLS cert for ${SERVER_NAME}"

  SAN_DNS="DNS:localhost"
  SAN_IP="IP:127.0.0.1"

  if echo "${SERVER_NAME}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    SAN_IP="${SAN_IP},IP:${SERVER_NAME}"
  else
    SAN_DNS="${SAN_DNS},DNS:${SERVER_NAME}"
  fi

  openssl req -x509 -newkey rsa:2048 -nodes \
    -days 365 \
    -keyout "${KEY}" \
    -out "${CERT}" \
    -subj "/CN=${SERVER_NAME}" \
    -addext "subjectAltName=${SAN_DNS},${SAN_IP}"
fi

exec nginx -g "daemon off;"

