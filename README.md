# RailYatra

**RailYatra** (*rail journey* in Hindi) — a production-ready Indian railway reservation platform with separated **React frontend** and **Node.js backend**, powered by **Microsoft SQL Server**.

## Project Structure

```
├── client/              # React 19 + Vite frontend (primary UI)
│   ├── public/          # Static assets (logo, banners)
│   └── src/             # Pages, components, styles
├── backend/             # Node.js + Express API
│   ├── middleware/      # Auth, admin, validation
│   ├── repositories/    # Data access layer
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   └── server.js
├── database/            # SQL Server schema, seeds, imports
├── frontend/            # Legacy vanilla HTML UI (optional)
├── data/railway/        # Processed railway master datasets
├── docs/                # OpenAPI spec and data docs
├── scripts/             # Startup and utility scripts
├── package.json
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | **React 19** + Vite + React Router |
| Backend | Node.js, Express.js |
| Database | Microsoft SQL Server |
| Driver | mssql + msnodesqlv8 |
| Auth | JWT + bcrypt |
| Validation | express-validator |

## Quick Start

```bash
# 1. Start LocalDB (Windows)
sqllocaldb start MSSQLLocalDB

# 2. Install dependencies (backend + React client)
npm run install:all

# 3. Configure environment
copy backend\.env.example backend\.env

# 4. Setup database
npm run db:setup

# 5. Run application (builds React UI if needed)
npm start
```

Open **http://localhost:5000**

### Development (hot reload UI)

Terminal 1 — API server:
```bash
npm run dev
```

Terminal 2 — React dev server (proxies `/api` to port 5000):
```bash
npm run client:dev
```

Open **http://localhost:5173**

### Railway master data (optional — India-wide timetable)

```bash
# Download DataMeet open dataset (~2016, CC0 — NOT official IRCTC)
npm run download:railway

# Bulk import stations, trains, stops (~7 minutes)
npm run import:datameet

# Verify search works
node database/verify-search.js
```

After import you get ~8,988 stations, ~5,207 trains, and ~417k stops. See `data/railway/RailwayDataImportReport.json` for honest counts and limitations.

**API documentation:** http://localhost:5000/api/swagger

**Admin master data panel:** Admin Portal → Master Data

To use offline mock data instead of the live API, run in browser console:
`localStorage.setItem('railwayUseMock', 'true'); location.reload()`

## Default Admin

| Field | Value |
|-------|-------|
| Email | `admin@railway.com` |
| Password | `Admin@123` |

Admin panel: http://localhost:5000/adminLogin.html

## Environment Variables

```env
DB_SERVER=(localdb)\MSSQLLocalDB
DB_NAME=RailwayReservation
DB_TRUSTED_CONNECTION=true
JWT_SECRET=your_secret_key
PORT=5000
ADMIN_EMAIL=admin@railway.com
ADMIN_PASSWORD=Admin@123
```

## API Endpoints

| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Private |
| GET | `/api/trains` | Public |
| GET | `/api/trains/search` | Public |
| GET | `/api/stations` | Public |
| GET | `/api/stations/search?q=` | Public |
| GET | `/api/bookings/pnr/:pnr` | Public |
| GET | `/api/trains/:id/seats?classCode=&journeyDate=` | Public |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password` | Public |
| GET | `/api/captcha` | Public |
| GET | `/api/trains/autocomplete?q=` | Public |
| GET | `/api/trains/:id/route` | Public |
| GET | `/api/fares/estimate` | Public |
| GET | `/api/availability/check` | Public |
| GET | `/api/admin/trains` | Admin |
| GET | `/api/admin/data-import/status` | Admin |
| GET | `/api/swagger` | Public |
| GET | `/api/openapi.yaml` | Public |
| GET | `/api/docs` | Public |
| GET | `/api/bookings/:id/refund-preview` | Private |
| GET | `/api/admin/reports/refunds` | Admin |
| POST | `/api/payments/create-order` | Private |
| POST | `/api/payments/verify` | Private |
| POST | `/api/payments/dev-confirm` | Private |
| POST/PUT/DELETE | `/api/trains` | Admin |
| GET/POST | `/api/bookings` | Private |
| GET | `/api/bookings/all` | Admin |
| GET | `/api/admin/dashboard` | Admin |
| GET | `/api/admin/bookings` | Admin |
| GET | `/api/admin/users` | Admin |
| PUT | `/api/admin/users/:id` | Admin |
| GET | `/api/admin/reports/revenue` | Admin |
| GET | `/api/admin/reports/occupancy` | Admin |
| GET | `/api/admin/reports/cancellations` | Admin |
| POST | `/api/admin/waitlist/promote` | Admin |
| POST/PUT/DELETE | `/api/stations` | Admin |

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm test` | Run API integration tests |
| `npm run dev` | Start with nodemon |
| `npm run db:setup` | Create tables + seed data (`database/`) |
| `npm run db:sync` | Sync database schema (`database/sync.js`) |
| `npm run db:seed` | Seed stations, trains, admin (`database/seed.js`) |
| `npm run download:railway` | Download DataMeet JSON to `data/railway/raw/` |
| `npm run import:railway` | Import dev CSV sample (~24 stations, 8 trains) |
| `npm run import:datameet` | Bulk import DataMeet JSON (~5k trains) |
| `npm run db:migrate-master` | Link legacy seed rows to normalized FKs |

## Phase 6 Features — Railway Master Data Architecture

- **Normalized schema** — States, Cities, Zones, TrainStops with day offsets, segment fares, import audit
- **Import pipeline** — Idempotent CSV + DataMeet JSON importers with error reports
- **Train-between-stations search** — Graph search via intermediate stops (`fromStopOrder < toStopOrder`)
- **Multi-day running logic** — Source departure date from day offsets; skips day filter when running days missing
- **Admin trains UI** — Paginated list, filters, full route timeline with day/distance/platform
- **Passenger search** — Station autocomplete, train autocomplete, route modal
- **Category B simulation** — Fares and availability are development-only, separate from master data
- **Segment bookings** — Route-segment seat allocations stored in `BookingSeatAllocations`
- **Swagger UI** — Interactive API docs at `/api/swagger`
- **Documentation** — `docs/RAILWAY_DATA_*.md` architecture, import, dictionary

## Phase 1 Features

- **Station autocomplete** — search stations by name, code, or city
- **Train classes** — SL, 3A, 2A, 1A, CC, 2S, EC with per-class pricing and availability
- **PNR enquiry** — check booking status with 10-digit PNR (no login required)

## Phase 2 Features

- **Interactive seat selection** — pick specific seats from a visual seat map
- **Razorpay payments** — pay before confirmation (dev mode auto-confirms without API keys)
- **Waiting list** — join waitlist when seats are full; auto-promoted on cancellation
- **Tatkal booking** — +30% fare for journeys 1–2 days away

## Phase 3 Features

- **Admin dashboard** — overview stats, recent bookings, sidebar navigation
- **Train schedule management** — running days and running status (Running/Cancelled/Diverted)
- **Booking management** — filter by PNR, status, date; cancel and promote waitlist
- **User management** — promote to admin, block/unblock users
- **Station management** — add, edit, delete stations
- **Reports** — revenue trends, cancellation trends, train occupancy by class

## Phase 4 Features

- **Mobile-first UI** — hamburger navigation, responsive modals and layouts
- **Captcha protection** — on login, register, booking, and admin login
- **Forgot password** — email reset link (dev mode shows link in response without SMTP)
- **E-ticket PDF** — download confirmed booking tickets from My Bookings
- **Rate limiting** — API, auth, and booking endpoints
- **Security headers** — Helmet middleware
- **Structured logging** — Winston logs in `backend/logs/`
- **Integration tests** — `npm test`

## Phase 5 Features

- **Cancellation refunds** — IRCTC-style rules (100%/50%/25% by time before journey, ₹20/passenger charge)
- **Refund preview** — see estimated refund before confirming cancellation
- **Train route stops** — view intermediate stations, timings, and distance
- **Passenger quotas** — General, Ladies, Senior Citizen (40% discount)
- **Booking confirmation email** — sent on payment confirmation (SMTP or dev log)
- **Admin refund reports** — total refunded, refund history
- **Docker deployment** — `Dockerfile` + `docker-compose.yml`

## License

MIT
