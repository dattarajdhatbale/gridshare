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
    <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] p-6 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 mt-[22px] role-card">
      <div className="flex justify-between items-start">
        <div>
          <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">SELECTED METER ANALYTICS</label>
          <h2 className="font-semibold text-[20px] font-title mt-1.5 mb-0 mx-0 tracking-[-0.02em] text-[var(--text-primary)]">
            {meter.id} ({meter.name}) · <em className="not-italic capitalize">{seller ? 'Seller' : 'Buyer'}</em>
          </h2>
        </div>
      </div>

      <div className="mt-[22px] mx-0 mb-4">
        <b className="font-semibold text-[32px] font-title block text-[var(--text-primary)] tracking-[-0.03em] leading-none mb-1.5">{energyAmount.toFixed(2)} kWh</b>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] uppercase">{seller ? 'surplus available for P2P sharing' : 'deficit imported from community'}</span>
      </div>

      <div className="my-4 mx-0 border-t border-[var(--line)] pt-4">
        <h4 className="m-0 mb-2.5 text-[11px] tracking-[0.08em] text-[var(--text-secondary)] uppercase">
          {seller ? 'Surplus Sharing Activity' : 'Surplus Consumption Activity'}
        </h4>

        {activeTrades.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeTrades.map((t) => (
              <div
                key={t.id}
                className="flex justify-between bg-mint py-2.5 px-3.5 rounded-lg border border-[var(--card-border)] text-[13px]"
              >
                <div>
                  <strong>{seller ? 'Shared with' : 'Consuming from'} </strong>
                  <span className="font-mono font-semibold rounded-[20px] align-middle ml-1.5 tracking-[0.06em] uppercase bg-[rgba(81,150,200,0.12)] text-[#3b82f6] border border-[rgba(81,150,200,0.15)] py-0.5 px-1.5 text-[11px]">
                    {getMeterId(seller ? t.buyer : t.seller)}
                  </span>
                </div>
                <div>
                  <b className="font-semibold">{t.kwh.toFixed(2)} kWh</b>
                  <span className="text-[var(--text-muted)] text-[11px] ml-1.5">
                    (₹{t.price.toFixed(2)}/kWh)
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] rounded-lg text-[13px] text-[var(--text-muted)] text-center">
            No active P2P transfers in this interval. Standard grid rates apply.
          </div>
        )}
      </div>

      <div className="flex justify-between border-t border-[var(--line)] pt-3.5 text-[12px]">
        <div>
          <span className="block text-[var(--text-muted)]">
            {seller ? 'Current tick capital gain' : 'Current tick capital saving'}
          </span>
          <b className="text-[#C06B22] dark:text-[#E5C378] text-[14px] font-bold">
            +₹{currentTickBenefit.toFixed(2)}
          </b>
        </div>
        <div className="text-right">
          <span className="block text-[var(--text-muted)]">
            {seller ? 'Total capital gain over standard grid export' : 'Total capital saving over standard grid import'}
          </span>
          <b className="text-[#C06B22] dark:text-[#E5C378] text-[14px] font-bold">
            +₹{earned.toFixed(2)}
          </b>
        </div>
      </div>
    </section>
  );
}
