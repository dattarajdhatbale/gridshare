export type Role = 'solar' | 'consumer' | 'prosumer';

export interface Meter {
  id: string;
  name: string;
  role: Role;
  pv: number;
  baseLoad: number;
  generation: number;
  load: number;
  exportKWh: number;
  importKWh: number;
  net: number;
  voltage: number;
  current: number;
  powerFactor: number;
  status: 'surplus' | 'deficit';
  distance: number;
}

export interface Trade {
  id: string;
  buyer: string;
  seller: string;
  sent: number;
  delivered: number;
  kwh: number;
  lossKWh: number;
  distance: number;
  lossFrac: number;
  lossPct: number;
  nCharge: number;
  energyPrice: number;
  buyerUnitPrice: number;
  price: number;
  buyerPayment: number;
  sellerRevenue: number;
  networkRevenue: number;
  time: string;
}

export interface Order {
  id: string;
  side: 'bid' | 'ask';
  owner: string;
  kwh: number;
  price: number;
}

export const PFIT = 4.00; // seller export utility rate (₹4/kWh)
export const PGRID = 7.00; // buyer import grid rate (₹7/kWh)

// Seed details: [id, name, role, pv, baseLoad, distance]
const seedData: [string, string, Role, number, number, number][] = [
  ['M-01', 'Asha Solar', 'solar', 4.8, 1.7, 0],
  ['M-02', 'Ravi Home', 'consumer', 0.0, 3.4, 120],
  ['M-03', 'Meera House', 'prosumer', 3.9, 2.0, 180],
  ['M-04', 'Ananya Villa', 'solar', 5.2, 1.6, 250],
  ['M-05', 'Kabir Home', 'consumer', 0.0, 2.7, 310],
  ['M-06', 'Ishita Flat', 'prosumer', 2.8, 2.1, 380],
  ['M-07', 'Nikhil Home', 'consumer', 0.0, 2.4, 460],
  ['M-08', 'Tara Solar', 'solar', 4.3, 1.2, 510],
  ['M-09', 'Dev House', 'prosumer', 3.1, 2.5, 580],
  ['M-10', 'Saanvi Home', 'consumer', 0.0, 2.9, 640],
  ['M-11', 'Arjun Solar', 'solar', 3.7, 1.4, 700],
  ['M-12', 'Zoya Home', 'consumer', 0.0, 2.2, 760],
];

export const seedMeters: Meter[] = seedData.map(([id, name, role, pv, baseLoad, distance]) => ({
  id,
  name,
  role,
  pv,
  baseLoad,
  generation: 0,
  load: 0,
  exportKWh: 0,
  importKWh: 0,
  net: 0,
  voltage: 230,
  current: 0,
  powerFactor: 1.0,
  status: 'deficit',
  distance,
}));

export const baseTrades: Trade[] = [];

function hash(x: number): number {
  const s = Math.sin(x) * 10000;
  return s - Math.floor(s);
}

export function lmpFor(supply: number, demand: number): number {
  if (supply === 0 && demand === 0) return 5.50;
  return Math.max(PFIT, Math.min(PGRID, (supply * PFIT + demand * PGRID) / (supply + demand)));
}

export function simulateMetersForTick(tick: number): Meter[] {
  const hour = (9 + tick / 4) % 24;
  const daylight = Math.max(0, Math.min(1, Math.sin(((hour - 6) / 12) * Math.PI)));

  return seedMeters.map((m, i) => {
    const r1 = hash(tick * 13 + i * 37);
    const r2 = hash(tick * 17 + i * 43);
    const r3 = hash(tick * 23 + i * 47);

    // Generation (kW)
    const cloud = m.role === 'consumer' ? 0 : 0.72 + r1 * 0.33; // 0.72 to 1.05
    const genKW = m.role === 'consumer' ? 0 : m.pv * daylight * cloud;
    // Generation in kW
    const generation = genKW;

    // Load (kW)
    const loadKW = Math.max(0.25, m.baseLoad * (0.82 + r2 * 0.36)); // 0.82 to 1.18
    // Load in kW
    const load = loadKW;

    const net = generation - load;
    const exportKWh = Math.max(0, net) * 0.25;
    const importKWh = Math.max(0, -net) * 0.25;

    const voltage = 230.5 + (r3 * 3.0 - 1.5) - exportKWh * 0.8;
    const pf = Math.max(0.88, Math.min(1.0, 0.93 + r1 * 0.065));
    const current = (loadKW || 0.1) * 1000 / (Math.max(voltage, 1) * pf);

    return {
      ...m,
      generation,
      load,
      exportKWh,
      importKWh,
      net,
      voltage,
      current,
      powerFactor: pf,
      status: net > 0 ? 'surplus' : 'deficit',
    };
  });
}

function lineLossFraction(distance: number): number {
  // CONFIG.lossRatePer100m = 0.018 (1.8% per 100m), capped at 18%
  return Math.max(0, Math.min(0.18, (distance / 100) * 0.018));
}

function networkCharge(distance: number): number {
  // CONFIG.baseNetwork = 0.18, CONFIG.distanceRate = 0.00055
  return 0.18 + 0.00055 * distance;
}

export function matchOrders(orders: Order[], tick: number): Trade[] {
  // Deprecated in favor of direct optimizeTrades, but kept for interface compatibility
  return [];
}

export function optimizeTrades(meters: Meter[]): Trade[] {
  const baseEnergyPrice = 4.00 + 0.5 * (7.00 - 4.00); // alpha = 0.50 -> ₹5.50

  const sellers = meters
    .filter((x) => x.exportKWh > 1e-6)
    .map((x) => ({ id: x.id, name: x.name, supply: x.exportKWh, distance: x.distance }));
  const buyers = meters
    .filter((x) => x.importKWh > 1e-6)
    .map((x) => ({ id: x.id, name: x.name, demand: x.importKWh, distance: x.distance }));

  // Sort buyers: match nearby/low-loss buyers first
  buyers.sort((a, b) => a.distance - b.distance);

  const trades: Trade[] = [];
  let tradeCounter = 0;

  for (const b of buyers) {
    if (b.demand <= 1e-7) continue;

    // Among available sellers, sort by network cost to this buyer
    sellers.sort((a, c) => {
      const distA = Math.abs(a.distance - b.distance);
      const distC = Math.abs(c.distance - b.distance);
      return networkCharge(distA) - networkCharge(distC);
    });

    for (const s of sellers) {
      if (s.supply <= 1e-7 || b.demand <= 1e-7) continue;

      const distance = Math.abs(s.distance - b.distance);
      const lossFrac = lineLossFraction(distance);
      const possibleDelivered = s.supply * (1 - lossFrac);
      const delivered = Math.min(b.demand, possibleDelivered);
      const sent = delivered / (1 - lossFrac);
      const lossKWh = sent - delivered;

      const nCharge = networkCharge(distance);
      const lossValue = lossKWh * PGRID;
      const buyerUnitPrice = baseEnergyPrice + nCharge + lossValue / Math.max(delivered, 1e-9);

      // If route is more expensive than utility grid, do not use it
      if (buyerUnitPrice >= PGRID - 1e-6) continue;

      const sellerRevenue = sent * baseEnergyPrice;
      const buyerPayment = delivered * buyerUnitPrice;

      tradeCounter++;
      trades.push({
        id: `T-${1000 + tradeCounter}`,
        buyer: b.name,
        seller: s.name,
        sent,
        delivered,
        kwh: delivered,
        lossKWh,
        distance,
        lossFrac,
        lossPct: lossFrac * 100,
        nCharge,
        energyPrice: baseEnergyPrice,
        buyerUnitPrice,
        price: buyerUnitPrice,
        buyerPayment,
        sellerRevenue,
        networkRevenue: buyerPayment - sellerRevenue,
        time: 'now',
      });

      s.supply -= sent;
      b.demand -= delivered;
    }
  }

  return trades;
}

export function ordersFor(meters: Meter[], price: number): Order[] {
  const asks = meters
    .filter((m) => m.exportKWh > 1e-6)
    .map((m, i) => ({
      id: `A-${i}`,
      side: 'ask' as const,
      owner: m.name,
      kwh: Number(m.exportKWh.toFixed(1)),
      price: Number(Math.max(PFIT, price - 0.18 - (i % 3) * 0.06).toFixed(2)),
    }));
  const bids = meters
    .filter((m) => m.importKWh > 1e-6)
    .map((m, i) => ({
      id: `B-${i}`,
      side: 'bid' as const,
      owner: m.name,
      kwh: Number(m.importKWh.toFixed(1)),
      price: Number(Math.min(PGRID, price + 0.16 - (i % 3) * 0.04).toFixed(2)),
    }));
  return [...asks, ...bids];
}
