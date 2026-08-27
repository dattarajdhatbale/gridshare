import { Meter, Trade } from '../simulation/model';

interface MeterRoleCardProps {
  meter: Meter;
  lmp: number;
  trades: Trade[];
  earned?: number;
  override: 'auto' | 'seller' | 'buyer';
  setOverride: (v: 'auto' | 'seller' | 'buyer') => void;
}

export function MeterRoleCard({
  meter,
  lmp,
  trades,
  earned = 0,
  override,
  setOverride,
}: MeterRoleCardProps) {
  const seller = override === 'seller' || (override === 'auto' && meter.status === 'surplus');
  const match = trades.find((t) => (seller ? t.seller === meter.name : t.buyer === meter.name));

  const energyAmount = seller
    ? Math.max(0, meter.generation - meter.load)
    : Math.max(0, meter.load - meter.generation);

  return (
    <section className="card role-card">
      <div className="role-top">
        <div>
          <label>SELECTED METER / LIVE MATCH</label>
          <h2>{seller ? 'Seller' : 'Buyer'} view</h2>
        </div>
        <div className="toggle">
          <button className={override === 'auto' ? 'active' : ''} onClick={() => setOverride('auto')}>
            Auto
          </button>
          <button
            className={override === 'seller' ? 'active' : ''}
            onClick={() => setOverride('seller')}
          >
            Seller
          </button>
          <button className={override === 'buyer' ? 'active' : ''} onClick={() => setOverride('buyer')}>
            Buyer
          </button>
        </div>
      </div>

      <div className="role-number">
        <b>{energyAmount.toFixed(1)} kWh</b>
        <span>{seller ? 'available surplus' : 'current deficit'}</span>
      </div>

      {match ? (
        <div className="counterparty">
          <div>
            <small>{seller ? 'CURRENTLY BUYING FROM YOU' : 'CURRENTLY SUPPLYING YOU'}</small>
            <b>{seller ? match.buyer : match.seller}</b>
          </div>
          <div>
            <b>
              {match.kwh.toFixed(1)} kWh · ₹{match.price.toFixed(2)}
            </b>
            <span>{match.distance}m away</span>
          </div>
        </div>
      ) : (
        <div className="counterparty">
          <span>No compatible match at this tick</span>
        </div>
      )}

      <div className="role-foot">
        <span>
          {seller ? 'Current ask price' : 'Current bid price'} <b>₹{lmp.toFixed(2)}/kWh</b>
        </span>
        <span>
          {seller ? 'Cumulative revenue' : 'Savings vs ₹7 grid'}{' '}
          <b className="green-text">+₹{earned.toFixed(2)}</b>
        </span>
      </div>
    </section>
  );
}
