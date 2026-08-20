# Warehouse Packing System

Web app for SOW-based warehouse packing: Express API, React UI, MongoDB — written in **TypeScript**.

## Stack

- **API:** Node.js, Express, Mongoose, JWT, bcrypt (`tsx` for TypeScript)
- **UI:** React (Vite + TypeScript), React Router, Tailwind CSS, html5-qrcode
- **DB:** MongoDB

## Run locally

1. Start MongoDB (Docker is included):

```bash
docker compose up -d
```

Or use a local/Atlas MongoDB URI in `server/.env`.

2. Install and seed:

```bash
npm run install:all
npm run seed
```

3. Start API + UI:

```bash
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:5001

### Demo accounts

| Role     | Username  | Password     |
|----------|-----------|--------------|
| Admin    | `admin`   | `admin123`   |
| Worker   | `worker`  | `worker123`  |
| PO clerk | `poclerk` | `poclerk123` |

## TypeScript

- Server: `server/src/**/*.ts` — run with `tsx` (`npm run build` emits to `dist/`)
- Client: `client/src/**/*.tsx` — Vite + `tsc --noEmit` on build
