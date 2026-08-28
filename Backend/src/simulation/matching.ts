import { Meter, Trade, PGRID, PFIT } from './model';
import { lmpFor } from './simulator';

function lineLossFraction(distance: number): number {
  return Math.max(0, Math.min(0.18, (distance / 1000) * 0.015));
}

function networkCharge(distance: number): number {
  return 0.18 + 0.00055 * distance;
}

export function optimizeTrades(meters: Meter[]): Trade[] {
  const S = meters.reduce((a, x) => a + x.exportKWh, 0);
  const D = meters.reduce((a, x) => a + x.importKWh, 0);
  const baseEnergyPrice = lmpFor(S, D, PFIT, PGRID);

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
        time: new Date().toISOString(),
      });

      s.supply -= sent;
      b.demand -= delivered;
    }
  }

  return trades;
}
