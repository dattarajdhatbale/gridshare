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
    <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] p-6 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">COMMUNITY METRICS</label>
          <h2 className="font-semibold text-[20px] font-title mt-1.5 mb-0 mx-0 tracking-[-0.02em] text-[var(--text-primary)]">Demand & Supply Curve</h2>
        </div>
        <TrendingUp size={22} className="text-[#C06B22] dark:text-[#E5C378]" />
      </div>

      <div className="flex gap-5 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--text-primary)] dark:bg-[#D7C9AE]" />
          <strong>{supply.toFixed(1)} kW</strong>
          <span className="text-[var(--text-muted)]">Supply</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C06B22] dark:bg-[#E09852]" />
          <strong>{demand.toFixed(1)} kW</strong>
          <span className="text-[var(--text-muted)]">Demand</span>
        </div>
      </div>

      <div className="relative h-[180px] bg-mint rounded-[10px] overflow-hidden border border-[var(--card-border)] p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full block"
        >
          {/* Areas */}
          <path d={supplyArea} fill="rgba(45, 45, 45, 0.06)" className="dark:fill-[rgba(215,201,174,0.06)]" />
          <path d={demandArea} fill="rgba(192, 107, 34, 0.06)" className="dark:fill-[rgba(224,152,82,0.06)]" />

          {/* Lines */}
          <path d={supplyPath} fill="none" stroke="currentColor" className="text-[var(--text-primary)] dark:text-[#D7C9AE]" strokeWidth="2.5" />
          <path d={demandPath} fill="none" stroke="#C06B22" className="dark:stroke-[#E09852]" strokeWidth="2.5" />
        </svg>

        <div className="absolute bottom-2 right-3 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--card-bg)] px-2 py-0.5 rounded-[6px] border border-[var(--card-border)]">
          {balanceStatus}
        </div>
      </div>
    </section>
  );
}
