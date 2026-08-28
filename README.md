# ⚡ GridShare

**GridShare** is a web-based prototype designed to simulate and visualize peer-to-peer (P2P) renewable energy sharing across localized community microgrids. Built with modern web technologies, it models real-time energy production, consumption dynamics, network line losses, and decentralized matching algorithms to demonstrate keeping value local.

---

## 🌟 Key Features

* **Microgrid Energy Simulation Engine**: Seeded, client-side model simulating 15-minute interval smart-meter readings.
* **Neighborhood Topology Map**: Visual network graphing active microgrid nodes (Producers, Prosumers, Consumers) and real-time bilateral power flows.
* **Granular Meter Analytics**: Dynamic panel detailing specific meter imports/exports, direct P2P transfer lists, and cumulative capital benefits compared to grid defaults.
* **Deterministic Verification**: Seeded pseudo-random generation ensuring consistent, smooth simulations for any selected interval.

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
    ├── main.tsx            # Application flow and dashboard state controller
    ├── components/         # Core modular UI components
    │   ├── Header.tsx      # Clean, minimal top header bar
    │   ├── TopologyGraph.tsx # Community microgrid map view
    │   ├── SimulationControls.tsx # Play, pause, speed, and timeline controls
    │   └── MeterRoleCard.tsx # Detailed billing analytics & transaction lists
    ├── styles.css          # Global styling rules & design tokens
    └── simulation/
        └── model.ts        # P2P matching logic, network math, and physics
```

---

## 🔄 Application Flow

GridShare follows a reactive unidirectional flow from simulation physics to interactive visualization:

1. **Simulation Ticking**: The dashboard runs on a timeline of `96 ticks` (each representing a 15-minute interval in a 24-hour day). Time increments automatically at a speed selected by the user (`1x`, `2x`, `4x`).
2. **Deterministic Meter Physics**: For every tick, the simulator computes the solar generation and consumer load for each of the 12 neighborhood nodes based on daylight curves and seeded pseudo-random weather parameters.
3. **Bilateral P2P Energy Matching**:
   * Meters with surplus generation register as **Sellers**.
   * Meters with net deficits register as **Buyers**.
   * The market matching engine pairs buyers and sellers based on geographical distance and network fees.
4. **Benefit Settlement**:
   * Saves transaction flows in a local ledger.
   * Compares P2P clearing prices against utility defaults (standard ₹4.00/kWh export rate and ₹7.00/kWh import rate).
   * Accumulates cumulative capital gains (for sellers) and capital savings (for buyers).
5. **UI Rendering**: The UI displays the aggregate microgrid throughput in the header ticker, maps active bilateral connections in the neighborhood graph, and lists exact transactions and savings for any selected node.

---

## 📊 Mock Data Model

The simulation utilizes 12 smart meters seeded with realistic structural parameters:

| Meter ID | Name | Role | Peak Solar PV (kW) | Base Load (kW) | Relative Node Distance (m) |
|---|---|---|---|---|---|
| **M-01** | Asha Solar | Solar Producer | 4.8 | 1.7 | 0m (Reference Node) |
| **M-02** | Ravi Home | Consumer | 0.0 | 3.4 | 120m |
| **M-03** | Meera House | Prosumer | 3.9 | 2.0 | 180m |
| **M-04** | Ananya Villa | Solar Producer | 5.2 | 1.6 | 250m |
| **M-05** | Kabir Home | Consumer | 0.0 | 2.7 | 310m |
| **M-06** | Ishita Flat | Prosumer | 2.8 | 2.1 | 380m |
| **M-07** | Nikhil Home | Consumer | 0.0 | 2.4 | 460m |
| **M-08** | Tara Solar | Solar Producer | 4.3 | 1.2 | 510m |
| **M-09** | Dev House | Prosumer | 3.1 | 2.5 | 580m |
| **M-10** | Saanvi Home | Consumer | 0.0 | 2.9 | 640m |
| **M-11** | Arjun Solar | Solar Producer | 3.7 | 1.4 | 700m |
| **M-12** | Zoya Home | Consumer | 0.0 | 2.2 | 760m |

---

## 🧮 Algorithms and Formulas

### 1. Daylight Solar Curve
Rooftop PV generation utilizes a sinusoidal daylight model. Solar panels produce energy only between 6:00 AM (`tick 24`) and 6:00 PM (`tick 72`), peaking at noon:
$$\text{Hour} = \frac{\text{Tick}}{4}$$
$$\text{Daylight} = \max\left(0, \min\left(1, \sin\left(\frac{\text{Hour} - 6}{12} \cdot \pi\right)\right)\right)$$

### 2. Node Generation and Load Dynamics
Individual readings incorporate deterministic pseudo-random factors (for clouds and human activities) using a sine-based PRNG keyed to tick and node index:
$$\text{Gen}_{kW} = \text{PV} \cdot \text{Daylight} \cdot \text{CloudFactor}$$
$$\text{Load}_{kW} = \max\left(0.25, \text{BaseLoad} \cdot \text{ActivityFactor}\right)$$

Since readings occur in 15-minute blocks, energy volume (kWh) is calculated as:
$$\text{Generation}_{kWh} = \text{Gen}_{kW} \cdot 0.25$$
$$\text{Load}_{kWh} = \text{Load}_{kW} \cdot 0.25$$

### 3. Network Losses & Transmission Charges
Physical distance limits efficiency. Power transmission results in line loss and network usage charges:
* **Line Loss Fraction**: Capped at 18% max, incurring 1.8% loss per 100 meters:
  $$\text{LossFraction} = \max\left(0, \min\left(0.18, \frac{\text{Distance}}{100} \cdot 0.018\right)\right)$$
* **Network Infrastructure Charge**: Base fee of ₹0.18/kWh plus a distance rate of ₹0.00055/meter:
  $$\text{NetworkCharge} = 0.18 + 0.00055 \cdot \text{Distance}$$

### 4. Bilateral Matching Optimization
Bilateral trades are sorted and paired using the following sequence:
1. Calculate each node's net surplus ($\text{exportKWh}$) or net deficit ($\text{importKWh}$).
2. Sort deficit nodes (**Buyers**) by their location relative to the microgrid reference center (prioritizing inner-network consumers).
3. For each buyer, sort surplus nodes (**Sellers**) in ascending order of network cost (relative distance).
4. Match available surplus. Delivered energy equals:
   $$\text{Delivered}_{kWh} = \min\left(\text{Deficit}, \text{Surplus} \cdot (1 - \text{LossFraction})\right)$$
5. The base energy price is determined by splitting the cooperative trading surplus ($\alpha = 0.50$):
   $$\text{BaseEnergyPrice} = \text{FiT} + 0.5 \cdot (\text{GridRetail} - \text{FiT}) = 4.00 + 0.50 \cdot (7.00 - 4.00) = \text{₹}5.50\text{/kWh}$$
6. Buyer's total unit rate includes transmission network fees and standard grid-default compensation for physical losses:
   $$\text{LossValue} = \text{Loss}_{kWh} \cdot \text{GridRetail}$$
   $$\text{BuyerUnitPrice} = \text{BaseEnergyPrice} + \text{NetworkCharge} + \left(\frac{\text{LossValue}}{\text{Delivered}}\right)$$
7. **Economic Viability Check**: If the resulting $\text{BuyerUnitPrice} \ge \text{GridRetail}$ (₹7.00/kWh), the trade is rejected, and both nodes fallback to default grid trading.

### 5. Settlement Benefits
* **Seller P2P Capital Gain**: Realized benefit vs standard grid feed-in export (₹4.00/kWh):
  $$\text{SellerGain} = \text{Sent}_{kWh} \cdot (\text{BaseEnergyPrice} - 4.00)$$
* **Buyer P2P Capital Saving**: Avoided cost vs utility retail rates (₹7.00/kWh):
  $$\text{BuyerSaving} = \text{Delivered}_{kWh} \cdot (7.00 - \text{BuyerUnitPrice})$$