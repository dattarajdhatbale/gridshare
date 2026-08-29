# ⚡ GridShare Backend

The **GridShare Backend** is a Node.js + TypeScript service that runs the peer-to-peer (P2P) renewable energy sharing simulation, resolves bilateral trade matching clearing, persists analytics logs, and broadcasts real-time updates to connected dashboards.

---

## 🏗️ Architecture Design

The backend uses a clean, layered layout to ensure scalability and decoupling of code:

1. **Transport Layer (`server.ts` & `routes/api.ts`)**:
   - Manages Express.js HTTP routes for simulation settings and telemetry logs.
   - Hosts a WebSocket server on `/ws` to deliver real-time simulation updates.
2. **Business Simulation Layer (`simulation/`)**:
   - `simulator.ts`: Simulates household loads and sinusoidal daylight solar generation dynamics.
   - `matching.ts`: Clears surplus generation and deficits via distance-optimized bilateral matching contracts.
   - `engine.ts`: Singleton manager handling simulation tick loops, timer speed changes, and saving outputs.
3. **Database Data Layer (`prisma/` & `db/prismaClient.ts`)**:
   - Prisma ORM maps structured TypeScript queries to an **SQLite** database (`prisma/dev.db`), simplifying migrations to PostgreSQL/MongoDB if needed.

---

## 📊 Relational Database Models

We use Prisma with SQLite to model the microgrid elements:

* **`SimulationState`**: Single row representing current interval tick (0 to 95), play/pause state, speed (1x, 2x, 4x), and cumulative microgrid baseline.
* **`Meter`**: Static neighborhood configurations (solar capacity, distance, base load) and persistent benefit ledgers.
* **`MeterReading`**: Historical telemetry logs (voltage, generation, load) generated on each interval tick. Used to render history charts.
* **`Trade`**: Historical record of bilateral energy exchanges executed in P2P clearings.

---

## 🔌 API Documentation

### REST Endpoints
* **`GET /api/simulation/state`**: Return current tick parameters, live active readings, current ledger values, and partner counterparties.
* **`POST /api/simulation/control`**: Toggle play/pause or modify timeline speed (`1x`, `2x`, `4x`).
  - Body: `{ playing?: boolean, speed?: string }`
* **`POST /api/simulation/tick`**: Force-jump the simulation to a specific tick (e.g. tick 30 to simulate cloud cover).
  - Body: `{ tick: number }`
* **`POST /api/simulation/reset`**: Reset baseline statistics, reset meter profit totals, delete telemetry readings, and restart simulation.
* **`GET /api/simulation/history`**: Return sliding supply-demand chart logs for the last 15 ticks relative to the active server tick.

### WebSockets (`ws://localhost:5000/ws`)
Broadcasting occurs on every tick step. Clients receive a JSON payload containing:
```json
{
  "tick": 63,
  "playing": true,
  "speed": "1x",
  "cumulativeBaseline": 1240.25,
  "meters": [...],
  "trades": [...],
  "ledger": { "M-01": 12.50, ... },
  "sharedPartners": { "M-01": ["M-02", "M-03"], ... }
}
```

---

## 🛠️ How to run locally

1. Run database migrations to initialize SQLite:
   ```bash
   npx prisma migrate dev --name init
   ```
2. Seed initial meters configuration:
   ```bash
   npm run prisma:seed
   ```
3. Run the development server (runs with hot reloading):
   ```bash
   npm run dev
   ```

---

## 🔑 Authentication, Roles & Security

We have implemented lightweight authentication with a role split between **Household Residents** and the **Grid Operator**.

### 🌟 New Environment Variables
* **`OPERATOR_CODE`** (Backend): Secret credential used by the Grid Operator (defaults to `"grid-admin"`).
* **`DATABASE_URL`** (Backend): PostgreSQL connection string for production.
* **`VITE_API_BASE_URL`** (Frontend): Backend server HTTP API URL.
* **`VITE_WS_BASE_URL`** (Frontend): Backend server WebSocket gateway URL.

### 🔑 Demo Login Credentials
1. **Household Residents**:
   - Choose any household from the select grid on the login screen.
   - Enter their 4-digit PIN, which is deterministically generated as: `1000 + meter number` (e.g., **`M-01`** PIN is **`1001`**, **`M-03`** PIN is **`1003`**).
2. **Grid Operator**:
   - Select the Operator tab.
   - Enter the system code: **`grid-admin`** (or your custom `OPERATOR_CODE` env var value).

---

## 🚀 Production Database Migration (Render)

To apply the new auth session schemas and PINs to the existing Render database without losing any seeded meters or accumulated trade history:

1. **Configure Environment Variables**:
   In your Render service dashboard, ensure the `DATABASE_URL` env variable points to your live PostgreSQL database instance.

2. **Deploy the Migration**:
   Run the following command from the Backend root folder to apply the schema modifications (adding `Session` model, adding `pin` and `displayName` columns to `Meter` with safe default values):
   ```bash
   npx prisma db push
   ```
   *Note: Using `prisma db push` updates the remote database schema directly without dropping any tables or losing existing trade logs.*

3. **Backfill deterministic PINs**:
   Run the seed script to update the newly created `pin` column for all existing meters:
   ```bash
   npx ts-node prisma/seed.ts
   ```
   *This script upserts existing meter records, updating the deterministic PIN values and leaving existing trade lists, readings, and profit balances intact.*
