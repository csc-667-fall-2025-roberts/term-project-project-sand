## M5 (Webopoly) — Stack Overview

This directory is a self-contained stack:

- **Frontend**: Vite-built multi-page app (served via `vite preview`).
- **Backend**: Express API + Socket.IO realtime.
- **Postgres**: application database.
- **Nginx**: TLS termination + reverse proxy routing.

### Architecture

```mermaid
flowchart LR
  Browser[Browser]
  Nginx[Nginx_TLS_proxy]
  Frontend[Vite_preview_4173]
  Backend[Express_API_3000]
  Postgres[Postgres_5432]

  Browser -->|"HTTPS 443"| Nginx
  Nginx -->|"/"| Frontend
  Nginx -->|"/api/*"| Backend
  Nginx -->|"/socket.io/*"| Backend
  Backend --> Postgres
```

### URLs and ports

- **Public entrypoint**: `https://<PUBLIC_HOST-or-localhost>/`
- **Backend health**: `GET https://<PUBLIC_HOST-or-localhost>/api/health`
- **Local ports exposed by compose**:
  - `80` (redirects to `443`)
  - `443` (TLS)
  - `5432` (Postgres; only needed if you connect from your host)

## Quick start (Docker Compose)

### Prerequisites

- Docker + Docker Compose v2 (`docker compose`)

### Required environment

- **JWT_SECRET**: required.
- **PUBLIC_HOST**: optional; defaults to `localhost`.

Example (shell):

```bash
export JWT_SECRET='change-me'
export PUBLIC_HOST='localhost'
```

### Run

From this `M5/` directory:

```bash
docker compose up --build
```

Then open:

- `https://localhost/`

Notes:
- The proxy generates a **self-signed** TLS cert (stored under `M5/nginx/certs/`). Your browser will warn; proceed for local dev.

### Stop

```bash
docker compose down
```

### Reset Postgres data

Data is persisted at `M5/backend/logs/postgres/data/` (bind mount from the Postgres service). To reset:

```bash
docker compose down
rm -rf backend/logs/postgres/data
```

## Local development (without the proxy)

This is useful when you want fast hot-reload with Vite and `tsx watch`.

### 1) Start Postgres (Docker)

From `M5/`:

```bash
docker compose -f backend/compose.yaml up -d postgres
```

This exposes Postgres on `localhost:5432`.

### 2) Run the backend

From `M5/backend/`:

```bash
npm install
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/webopoly'
export JWT_SECRET='change-me'
export NODE_ENV='development'
# optional in dev; defaults allow localhost origins
npm run dev
```

Backend listens on `http://localhost:3000`.

### 3) Run the frontend

From `M5/frontend/`:

```bash
npm install
export VITE_API_ORIGIN='http://localhost:3000'
npm run dev
```

Frontend dev server is typically `http://localhost:5173`.

## Troubleshooting

- **CORS failure in production mode**: the backend requires `CORS_ORIGINS` when `NODE_ENV=production`.
  - In this stack, Compose sets `CORS_ORIGINS=https://${PUBLIC_HOST:-localhost}`.
- **Cookies/auth not working when mixing http/https**:
  - Compose uses `COOKIE_SECURE=true` in production which requires HTTPS.
  - If you run locally over `http://localhost:3000`/`http://localhost:5173`, keep `NODE_ENV=development`.
- **WebSocket connection issues**:
  - The proxy routes `/socket.io/` with upgrade headers; ensure you’re connecting to the same origin your page is served from.
- **TLS warnings**:
  - Expected with the self-signed cert; replace `M5/nginx/certs/fullchain.pem` and `M5/nginx/certs/privkey.pem` with real certs to remove warnings.
