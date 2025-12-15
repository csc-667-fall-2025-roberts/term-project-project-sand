## Frontend (M5)

Multi-page Vite frontend (TypeScript + Lit + Tailwind).

### Pages

The build is configured with multiple HTML entrypoints:

- `src/index.html` (dashboard)
- `src/login.html`
- `src/register.html`
- `src/game.html`

## Configuration

### `VITE_API_ORIGIN`

Controls which origin the frontend uses for:

- HTTP requests (base `/api/...`)
- Socket.IO connection origin

Resolution order:

1. If `VITE_API_ORIGIN` is set, it is used.
2. Otherwise, the app defaults to `window.location.origin`.

Examples:

- Local dev (backend on `http://localhost:3000`): `VITE_API_ORIGIN=http://localhost:3000`
- Docker/production behind nginx TLS: `VITE_API_ORIGIN=https://localhost` (or your public host)

## Run locally (development)

### Prerequisites

- Node.js (project Dockerfiles use Node `25.x`)
- A running backend

From `M5/frontend/`:

```bash
npm install
export VITE_API_ORIGIN='http://localhost:3000'

npm run dev
```

Vite will print the dev URL (commonly `http://localhost:5173`).

## Build and preview (production-like)

The Docker image runs `vite preview --host`, which serves the built `dist/` output.

From `M5/frontend/`:

```bash
npm install
export VITE_API_ORIGIN='https://localhost'

npm run build
npm run preview -- --host
```

This serves on port `4173` by default.

## Run with Docker Compose

The recommended entrypoint is `M5/compose.yaml`, which sets:

- `VITE_API_ORIGIN=https://${PUBLIC_HOST:-localhost}`

and places the app behind the nginx TLS proxy.

## Troubleshooting

- **Auth/cookies issues when mixing http and https**:
  - In the full stack, nginx is HTTPS and the backend is configured with secure cookies in production. Use a consistent HTTPS origin when running the full stack.
- **CORS errors**:
  - When the backend runs in production mode, it requires `CORS_ORIGINS` to include your frontend origin.
- **Realtime not connecting**:
  - Socket.IO is routed via `/socket.io/` at the same origin. Ensure `VITE_API_ORIGIN` matches the origin that should host Socket.IO.

## Quality scripts

From `M5/frontend/`:

```bash
npm run lint
npm run format
```
