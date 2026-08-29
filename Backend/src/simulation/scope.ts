import { Meter, Trade } from './model';

export interface ScopedStatePayload {
  tick: number;
  playing: boolean;
  speed: string;
  cumulativeBaseline: number;
  meters: any[];
  trades: Trade[];
  ledger: Record<string, number>;
  sharedPartners: Record<string, string[]>;
  viewer: {
    role: string;
    meterId: string | null;
  };
}

/**
 * Scopes the simulation state payload based on the user session role and meter ID.
 */
export function scopeStatePayload(payload: any, session: { role: string; meterId: string | null }): ScopedStatePayload {
  const viewer = {
    role: session.role,
    meterId: session.meterId,
  };

  // If the user is the operator, return the full payload unchanged
  if (session.role === 'operator') {
    return {
      ...payload,
      viewer,
    };
  }

  // Household role scoping
  const activeMeterId = session.meterId!;

  // 1. Filter trades to only those where the active household is buyer or seller
  const filteredTrades = (payload.trades || []).filter(
    (t: Trade) => t.buyer === activeMeterId || t.seller === activeMeterId
  );

  // Get active household counterparties in current trades
  const currentTradePartnerIds = new Set<string>();
  filteredTrades.forEach((t: Trade) => {
    if (t.buyer !== activeMeterId) currentTradePartnerIds.add(t.buyer);
    if (t.seller !== activeMeterId) currentTradePartnerIds.add(t.seller);
  });

  // Get active household historical counterparts
  const sharedPartnersForMe: string[] = payload.sharedPartners?.[activeMeterId] || [];
  const counterpartySet = new Set([...sharedPartnersForMe, ...currentTradePartnerIds]);

  // 2. Redact meters: keep the active household's meter full, and redact every other meter
  const scopedMeters = (payload.meters || []).map((m: Meter) => {
    if (m.id === activeMeterId) {
      return m; // Own meter in full
    }

    const isCounterparty = counterpartySet.has(m.id);

    // Redacted meter containing only public fields
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      distance: m.distance,
      displayName: m.displayName,
      isCounterparty,
    };
  });

  // 3. Filter ledger: contain only their own key
  const scopedLedger: Record<string, number> = {};
  if (payload.ledger && payload.ledger[activeMeterId] !== undefined) {
    scopedLedger[activeMeterId] = payload.ledger[activeMeterId];
  }

  // 4. Scoped shared partners: contain only the active household's list
  const scopedSharedPartners: Record<string, string[]> = {};
  if (payload.sharedPartners && payload.sharedPartners[activeMeterId] !== undefined) {
    scopedSharedPartners[activeMeterId] = payload.sharedPartners[activeMeterId];
  }

  return {
    tick: payload.tick,
    playing: payload.playing,
    speed: payload.speed,
    cumulativeBaseline: payload.cumulativeBaseline,
    meters: scopedMeters,
    trades: filteredTrades,
    ledger: scopedLedger,
    sharedPartners: scopedSharedPartners,
    viewer,
  };
}
