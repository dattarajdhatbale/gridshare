import { Gauge, Leaf } from 'lucide-react';

interface PricingPanelProps {
  lmp: number;
  supply: number;
  demand: number;
  pulse: boolean;
}

export function PricingPanel({ lmp, supply, demand, pulse }: PricingPanelProps) {
  return (
    <section className={`card pricing ${pulse ? 'pulse' : ''}`}>
      <div className="card-head">
        <div>
          <label>THE LOCAL ADVANTAGE</label>
          <h2>
            One neighbourhood.
            <br />
            <em>One fair price.</em>
          </h2>
        </div>
        <Gauge size={28} className="lime" />
      </div>
      
      <p className="muted">
        Our live price responds to supply and demand. It stays between what the grid pays and what the grid charges.
      </p>

      <div className="price-scale">
        <div>
          <span>₹3.00</span>
          <small>FiT / SELL TO GRID</small>
        </div>
        <div 
          className="needle" 
          style={{ left: `clamp(44px, ${((lmp - 3) / 4) * 100}%, calc(100% - 44px))` }}
        >
          <b>₹{lmp.toFixed(2)}</b>
          <span>LOCAL PRICE</span>
        </div>
        <div className="right">
          <span>₹7.00</span>
          <small>GRID / BUY FROM GRID</small>
        </div>
      </div>

      <div className="math">
        <span>S <b>{supply.toFixed(1)}</b> kW</span>
        <span>×</span>
        <span>₹3</span>
        <span>＋</span>
        <span>D <b>{demand.toFixed(1)}</b> kW</span>
        <span>×</span>
        <span>₹7</span>
        <span>／ S ＋ D</span>
      </div>

      <div className="aha">
        <Leaf size={18} />
        <span>
          <b>₹{(lmp - 3).toFixed(2)} more per kWh for sellers</b>
          <br />
          Buyers save vs the ₹7 grid rate. Value stays local.
        </span>
      </div>
    </section>
  );
}
