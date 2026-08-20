# Warehouse Packing System

Web app for SOW-based warehouse packing: Express API, React UI, MongoDB.

## Stack

- **API:** Node.js, Express, Mongoose, JWT, bcrypt
- **UI:** React (Vite), React Router, Tailwind CSS, html5-qrcode
- **DB:** MongoDB

## Run locally

1. Start MongoDB (Docker is included):

```bash
docker compose up -d
```

Or use a local MongoDB at `mongodb://127.0.0.1:27017`.

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

| Role   | Username | Password  |
|--------|----------|-----------|
| Admin  | `admin`  | `admin123` |
| Worker | `worker` | `worker123` |

Seeded catalog product IDs: `P000001` … `P000072` (SKUs `SKU-A100` through `SKU-F600`).

## Workflow

1. Sign in (admin or worker).
2. Dashboard → **Create SOW** (PO, SOW, Batch, Client + packing type).
3. Select SKU(s): types 1 & 2 require **one** SKU; type 3 requires **multiple**.
4. Packing page:
   - Create Box ID by camera QR/barcode or keyboard (capacity **30** products).
   - Types 2 & 3: Pallet ID (capacity **50** boxes). Boxes start unlinked; use **Link Box**.
   - Scan product IDs continuously. Duplicates toast for 3s: `{ProductID} have been store in {BOXID}`.
   - **Complete Box** to close the current box and start another.
   - **Finish / Confirm** validates SOW, PO, Client, Batch, Box ID, and Pallet ID (types 2/3). Unlinked boxes get a warning modal.

## RBAC

- **Worker:** dashboard + packing only.
- **Admin:** user management, packing history, system audit logs, and full packing access.
