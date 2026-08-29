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
  displayName?: string | null;
  earned?: number;
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

export const PFIT = 3.00; // seller export utility rate (₹3/kWh)
export const PGRID = 7.00; // buyer import grid rate (₹7/kWh)
