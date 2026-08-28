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
