# GridShare

GridShare is a web-based prototype designed to simulate and visualize peer-to-peer (P2P) renewable energy sharing across localized community microgrids. The project consists of a Node.js + TypeScript backend that runs the simulation and a React + TypeScript frontend dashboard that visualizes real-time power flows, network losses, and decentralized matching statistics.

---

# Part 1: Backend

The GridShare Backend is a Node.js + TypeScript service that runs the peer-to-peer (P2P) renewable energy sharing simulation, resolves bilateral trade matching clearing, persists analytics logs, and broadcasts real-time updates to connected dashboards.

## Architecture Design

The backend uses a clean, layered layout to ensure scalability and decoupling of code:

1. **Transport Layer (`server.ts` & `routes/api.ts`)**:
   - Manages Express.js HTTP routes for simulation settings and telemetry logs.
   - Hosts a WebSocket server on `/ws` to deliver real-time simulation updates.
2. **Business Simulation Layer (`simulation/`)**:
   - `simulator.ts`: Simulates household loads and sinusoidal daylight solar generation dynamics.
   - `matching.ts`: Clears surplus generation and deficits via distance-optimized bilateral matching contracts.
   - `engine.ts`: Singleton manager handling simulation tick loops, timer speed changes, and saving outputs.
3. **Database Data Layer (`prisma/` & `db/prismaClient.ts`)**:
   - Prisma ORM maps structured TypeScript queries to an SQLite database (`prisma/dev.db`), simplifying migrations to PostgreSQL/MongoDB if needed.

## Relational Database Models

We use Prisma with SQLite to model the microgrid elements:

* **`SimulationState`**: Single row representing current interval tick (0 to 95), play/pause state, speed (1x, 2x, 4x), and cumulative microgrid baseline.
* **`Meter`**: Static neighborhood configurations (solar capacity, distance, base load) and persistent benefit ledgers.
* **`MeterReading`**: Historical telemetry logs (voltage, generation, load) generated on each interval tick. Used to render history charts.
* **`Trade`**: Historical record of bilateral energy exchanges executed in P2P clearings.

## API Documentation

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

## How to Run the Backend Locally

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

## Authentication, Roles & Security

Lightweight authentication has been implemented with a role split between Household Residents and the Grid Operator.

### Environment Variables
* **`OPERATOR_CODE`** (Backend): Secret credential used by the Grid Operator (defaults to `"grid-admin"`).
* **`DATABASE_URL`** (Backend): PostgreSQL connection string for production.
* **`VITE_API_BASE_URL`** (Frontend): Backend server HTTP API URL.
* **`VITE_WS_BASE_URL`** (Frontend): Backend server WebSocket gateway URL.

### Demo Login Credentials
1. **Household Residents**:
   - Choose any household from the select grid on the login screen.
   - Enter their 4-digit PIN, which is deterministically generated as: `1000 + meter number` (e.g., `M-01` PIN is `1001`, `M-03` PIN is `1003`).
2. **Grid Operator**:
   - Select the Operator tab.
   - Enter the system code: `grid-admin` (or your custom `OPERATOR_CODE` env var value).

## Production Database Migration (Render)

To apply the new auth session schemas and PINs to the existing Render database without losing any seeded meters or accumulated trade history:

1. **Configure Environment Variables**:
   In your Render service dashboard, ensure the `DATABASE_URL` env variable points to your live PostgreSQL database instance.

2. **Deploy the Migration**:
   Run the following command from the Backend root folder to apply the schema modifications (adding `Session` model, adding `pin` and `displayName` columns to `Meter` with safe default values):
   ```bash
   npx prisma db push
   ```
   *Note: Using `prisma db push` updates the remote database schema directly without dropping any tables or losing existing trade logs.*

3. **Backfill Deterministic PINs**:
   Run the seed script to update the newly created `pin` column for all existing meters:
   ```bash
   npx ts-node prisma/seed.ts
   ```
   *This script upserts existing meter records, updating the deterministic PIN values and leaving existing trade lists, readings, and profit balances intact.*

---

# Part 2: Dashboard (Frontend)

The GridShare Dashboard is the frontend visualizing real-time power flows, network losses, and decentralized matching statistics powered by the Express.js + Prisma simulation backend.

## Key Features

* **Real-time Microgrid Synced UI**: Dynamic, responsive layout displaying solar generation and load balances.
* **Neighborhood Topology Map**: Visual network graphing active microgrid nodes (Producers, Prosumers, Consumers) and real-time bilateral power flows.
* **Granular Meter Analytics**: Detailed telemetry pane showing node imports/exports, direct P2P transfer lists, and persistent savings/earnings.
* **Simulation Speed Control**: Play, pause, or speed controls linked to the backend clock runner.

## Tech Stack

* **Frontend**: [React 18](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/) (configured with development API/WS proxies)
* **Styling**: Modern CSS (`src/styles.css`)

## Project Structure

```text
Frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── styles.css
    └── components/
        ├── Header.tsx
        ├── TopologyGraph.tsx
        ├── SimulationControls.tsx
        └── MeterRoleCard.tsx
```

## Client-Server Application Flow

GridShare follows a reactive unidirectional flow from backend simulation physics to interactive visualization:

1. **Simulation Ticking**: The backend server runs a simulation timeline of `96 ticks` (each representing a 15-minute interval in a 24-hour day). The backend timer increments automatically at the user-selected speed (`1x`, `2x`, `4x`) and broadcasts ticks via WebSockets.
2. **Deterministic Meter Physics**: For every tick, the backend simulator computes solar generation and consumer load for each of the 12 neighborhood nodes based on daylight curves.
3. **Bilateral P2P Energy Matching**:
   * Meters with surplus generation register as Sellers.
   * Meters with net deficits register as Buyers.
   * The backend market matching engine pairs buyers and sellers based on geographical distance and network fees.
4. **Benefit Settlement**:
   * Logs transaction flows in the SQLite database.
   * Compares P2P clearing prices against utility defaults (standard ₹4.00/kWh export rate and ₹7.00/kWh import rate).
   * Accumulates persistent savings and earnings records in the database.
5. **UI Rendering & Sync**: The frontend connects to the backend WebSocket stream to receive live simulation updates, updating the map topology and analytics cards. Users can play, pause, or adjust speed which communicates controls to the backend via HTTP REST APIs.
