# GridShare Dashboard

GridShare is a web-based prototype designed to simulate and visualize peer-to-peer (P2P) renewable energy sharing across localized community microgrids. This frontend dashboard visualizes real-time power flows, network losses, and decentralized matching statistics powered by the Express.js + Prisma simulation backend.

---

## Key Features

* **Real-time Microgrid Synced UI**: Dynamic, responsive layout displaying solar generation and load balances.
* **Neighborhood Topology Map**: Visual network graphing active microgrid nodes (Producers, Prosumers, Consumers) and real-time bilateral power flows.
* **Granular Meter Analytics**: Detailed telemetry pane showing node imports/exports, direct P2P transfer lists, and persistent savings/earnings.
* **Simulation Speed Control**: Play, pause, or speed controls linked to the backend clock runner.

---

## Tech Stack

* **Frontend**: [React 18](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/) (configured with development API/WS proxies)
* **Styling**: Modern CSS (`src/styles.css`)

---

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

---

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
