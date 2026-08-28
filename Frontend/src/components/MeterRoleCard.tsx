import { Meter, Trade } from '../simulation/model';

interface MeterRoleCardProps {
  meter: Meter;
  meters: Meter[];
  lmp: number;
  trades: Trade[];
  earned?: number;
}

export function MeterRoleCard({
  meter,
  meters,
  lmp,
  trades,
  earned = 0,
}: MeterRoleCardProps) {
  const seller = meter.status === 'surplus';

  // Find all active trades in this interval for the selected meter
  const activeTrades = trades.filter((t) => (seller ? t.seller === meter.name : t.buyer === meter.name));

  const energyAmount = seller ? meter.exportKWh : meter.importKWh;

  // Helper to map name to meter ID
  const getMeterId = (name: string) => meters.find((m) => m.name === name)?.id || name;

  // Calculate current tick benefits
  const currentTickBenefit = seller
    ? activeTrades.reduce((sum, t) => sum + t.sent * (t.energyPrice - 4.00), 0)
    : activeTrades.reduce((sum, t) => sum + t.delivered * (7.00 - t.buyerUnitPrice), 0);

  return (
    <section className="card role-card">
      <div className="role-top">
        <div>
          <label>SELECTED METER ANALYTICS</label>
          <h2>
            {meter.id} ({meter.name}) · <em style={{ textTransform: 'capitalize' }}>{seller ? 'Seller' : 'Buyer'}</em>
          </h2>
        </div>
      </div>

      <div className="role-number">
        <b>{energyAmount.toFixed(2)} kWh</b>
        <span>{seller ? 'surplus available for P2P sharing' : 'deficit imported from community'}</span>
      </div>

      <div className="analytics-details" style={{ margin: '16px 0', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          {seller ? 'Surplus Sharing Activity' : 'Surplus Consumption Activity'}
        </h4>

        {activeTrades.length > 0 ? (
          <div className="counterparty-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeTrades.map((t) => (
              <div
                key={t.id}
                className="counterparty-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'var(--mint)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--card-border)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <strong>{seller ? 'Shared with' : 'Consuming from'} </strong>
                  <span className="pill blue" style={{ padding: '2px 6px', fontSize: '11px' }}>
                    {getMeterId(seller ? t.buyer : t.seller)}
                  </span>
                </div>
                <div>
                  <b>{t.kwh.toFixed(2)} kWh</b>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>
                    (₹{t.price.toFixed(2)}/kWh)
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="counterparty-empty"
            style={{
              padding: '12px',
              background: 'rgba(0,0,0,0.02)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No active P2P transfers in this interval. Standard grid rates apply.
          </div>
        )}
      </div>

      <div className="role-foot" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: '14px', fontSize: '12px' }}>
        <div>
          <span style={{ display: 'block', color: 'var(--text-muted)' }}>
            {seller ? 'Current tick capital gain' : 'Current tick capital saving'}
          </span>
          <b className="green-text" style={{ fontSize: '14px' }}>
            +₹{currentTickBenefit.toFixed(2)}
          </b>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', color: 'var(--text-muted)' }}>
            {seller ? 'Total capital gain over standard grid export' : 'Total capital saving over standard grid import'}
          </span>
          <b className="green-text" style={{ fontSize: '14px' }}>
            +₹{earned.toFixed(2)}
          </b>
        </div>
      </div>
    </section>
  );
}
