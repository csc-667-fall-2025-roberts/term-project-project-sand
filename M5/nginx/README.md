## Nginx (M5)

This directory contains the TLS reverse proxy for the M5 stack.

### Responsibilities

- **TLS termination** on `443`.
- **HTTP → HTTPS redirect** on `80`.
- **Path routing**:
  - `/api/*` → backend service (`backend:3000`)
  - `/socket.io/*` → backend service with websocket upgrade
  - `/` → frontend preview server (`frontend:4173`)

## Certificates

On container start, `entrypoint.sh` ensures certs exist under `/etc/nginx/certs`:

- `fullchain.pem`
- `privkey.pem`

If they do not exist, a **self-signed certificate** is generated using the `SERVER_NAME` environment variable. In the default docker-compose stack, these certs are persisted to the host at:

- `M5/nginx/certs/`

### Using real certificates

Provide your own certs by mounting files into `M5/nginx/certs/`:

- `M5/nginx/certs/fullchain.pem`
- `M5/nginx/certs/privkey.pem`

Restart the stack after placing them.

## Environment

- **SERVER_NAME**: controls the CN/SAN in the generated self-signed cert.
  - The top-level stack sets this from `PUBLIC_HOST`.

## Local dev note

If you run the frontend/backend directly over HTTP during local development, you can skip nginx entirely.

Nginx is most useful for:

- matching production-style HTTPS + secure cookies
- exercising websocket proxying via `/socket.io/`
