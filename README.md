# ⚡ GridShare

**GridShare** is a web-based prototype designed to simulate and visualize peer-to-peer (P2P) renewable energy sharing across localized microgrids. Built with modern web technologies, it models real-time energy production, consumption dynamics, and decentralized grid balancing.

---

## 🌟 Key Features

* **Microgrid Energy Simulation Engine**: Real-time modeling of renewable generation (solar, wind), battery storage states (SOC), and localized energy demand.
* **Interactive UI Dashboard**: High-level and granular visualizations for monitoring energy trades, grid efficiency, and battery reserve levels.
* **Component-Based Architecture**: Modular React components for easy extension of grid nodes, simulation controls, and metric displays.
* **TypeScript Integration**: Type-safe simulation parameters, node metrics, and event handling.

---

## 🛠️ Tech Stack

* **Frontend**: [React 18](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Styling**: Modern CSS (`src/styles.css`)

---

## 📁 Project Structure

```text
gridshare/
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── src/
    ├── main.tsx            # Application entry point
    ├── components.tsx      # Core UI components & dashboard layouts
    ├── styles.css          # Global styling rules
    ├── vite-env.d.ts       # Vite TypeScript definitions
    └── simulation/
        └── model.ts        # Microgrid simulation logic & physics engine