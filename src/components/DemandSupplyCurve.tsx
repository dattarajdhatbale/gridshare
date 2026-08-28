import { TrendingUp } from 'lucide-react';

interface DemandSupplyCurveProps {
  supply: number;
  demand: number;
  history: { tick: number; supply: number; demand: number }[];
}

export function DemandSupplyCurve({ supply, demand, history }: DemandSupplyCurveProps) {
  // Find max value in history to scale properly
  const maxVal = Math.max(...history.flatMap((h) => [h.supply, h.demand]), 1);

  const width = 480;
  const height = 180;

  const getPoints = (key: 'supply' | 'demand') => {
    return history.map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      // scale y from 10px to height - 10px
      const y = height - (h[key] / maxVal) * (height - 20) - 10;
      return { x, y };
    });
  };

  const supplyPoints = getPoints('supply');
  const demandPoints = getPoints('demand');

  const supplyPath = supplyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const supplyArea = `${supplyPath} L ${width} ${height} L 0 ${height} Z`;

  const demandPath = demandPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const demandArea = `${demandPath} L ${width} ${height} L 0 ${height} Z`;

  const balanceStatus =
    supply > demand + 1.0
      ? 'Slightly higher supply'
      : demand > supply + 1.0
      ? 'Slightly higher demand'
      : 'Balanced Market';

  return (
    <section className="card ds-curve-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <label>COMMUNITY METRICS</label>
          <h2>Demand & Supply Curve</h2>
        </div>
        <TrendingUp size={22} className="lime" />
      </div>

      <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="dot solar-dot"
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--lime)',
            }}
          />
          <strong>{supply.toFixed(1)} kW</strong>
          <span style={{ color: 'var(--text-muted)' }}>Supply</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="dot load-dot"
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--orange)',
            }}
          />
          <strong>{demand.toFixed(1)} kW</strong>
          <span style={{ color: 'var(--text-muted)' }}>Demand</span>
        </div>
      </div>

      <div
        className="ds-curve-chart"
        style={{
          position: 'relative',
          height: `${height}px`,
          background: 'var(--mint)',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid var(--card-border)',
          padding: '4px',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Areas */}
          <path d={supplyArea} fill="rgba(0, 255, 136, 0.06)" />
          <path d={demandArea} fill="rgba(255, 159, 67, 0.06)" />

          {/* Lines */}
          <path d={supplyPath} fill="none" stroke="var(--lime)" strokeWidth="2.5" />
          <path d={demandPath} fill="none" stroke="var(--orange)" strokeWidth="2.5" />
        </svg>

        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '12px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'var(--card-bg)',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid var(--card-border)',
          }}
        >
          {balanceStatus}
        </div>
      </div>
    </section>
  );
}
