import { Gauge, Leaf } from 'lucide-react';

interface PricingPanelProps {
  lmp: number;
  supply: number;
  demand: number;
  pulse: boolean;
  history: { tick: number; supply: number; demand: number }[];
}

export function PricingPanel({ lmp, supply, demand, pulse, history }: PricingPanelProps) {
  // Find max value in history to scale properly
  const maxVal = Math.max(...history.flatMap((h) => [h.supply, h.demand]), 1);

  const width = 320;
  const height = 80;

  const getPoints = (key: 'supply' | 'demand') => {
    return history.map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      // scale y from 5px to height - 5px
      const y = height - (h[key] / maxVal) * (height - 10) - 5;
      return { x, y };
    });
  };

  const supplyPoints = getPoints('supply');
  const demandPoints = getPoints('demand');

  const supplyPath = supplyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const supplyArea = `${supplyPath} L ${width} ${height} L 0 ${height} Z`;

  const demandPath = demandPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const demandArea = `${demandPath} L ${width} ${height} L 0 ${height} Z`;

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

      <p className="muted" style={{ marginBottom: '14px' }}>
        Our live price responds to supply and demand. It stays between what the grid pays and what the grid charges.
      </p>

      {/* Demand Supply Curve Section */}
      <div className="ds-curve-container" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <span
              className="dot solar-dot"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--lime)',
                marginRight: '6px',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{supply.toFixed(1)} kW Supply</span>
          </div>
          <div>
            <span
              className="dot load-dot"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--orange)',
                marginRight: '6px',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{demand.toFixed(1)} kW Demand</span>
          </div>
        </div>

        <div
          className="ds-curve-chart"
          style={{
            position: 'relative',
            height: `${height}px`,
            background: 'var(--mint)',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--card-border)',
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Areas */}
            <path d={supplyArea} fill="rgba(0, 255, 136, 0.08)" />
            <path d={demandArea} fill="rgba(255, 159, 67, 0.08)" />

            {/* Lines */}
            <path d={supplyPath} fill="none" stroke="var(--lime)" strokeWidth="2" />
            <path d={demandPath} fill="none" stroke="var(--orange)" strokeWidth="2" />
          </svg>
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '8px',
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            {supply > demand
              ? 'Slightly higher supply'
              : supply < demand
              ? 'Slightly higher demand'
              : 'Balanced Market'}
          </div>
        </div>
      </div>

      <div className="price-scale" style={{ marginTop: '12px' }}>
        <div>
          <span>₹4.00</span>
          <small>FiT / SELL TO GRID</small>
        </div>
        <div
          className="needle"
          style={{ left: `clamp(44px, ${((lmp - 4) / 3) * 100}%, calc(100% - 44px))` }}
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
        <span>₹4</span>
        <span>＋</span>
        <span>D <b>{demand.toFixed(1)}</b> kW</span>
        <span>×</span>
        <span>₹7</span>
        <span>／ S ＋ D</span>
      </div>

      <div className="aha">
        <Leaf size={18} />
        <span>
          <b>₹{(lmp - 4).toFixed(2)} more per kWh for sellers</b>
          <br />
          Buyers save vs the ₹7 grid rate. Value stays local.
        </span>
      </div>
    </section>
  );
}
