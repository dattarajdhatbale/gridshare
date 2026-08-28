import { Meter } from '../simulation/model';

interface TopologyGraphProps {
  meters: Meter[];
  selected: Meter;
  onSelect: (m: Meter) => void;
  sharedPartners?: string[]; // IDs of partners shared with throughout the day
  activePartners?: string[]; // IDs of partners actively trading right now
}

export function TopologyGraph({
  meters,
  selected,
  onSelect,
  sharedPartners = [],
  activePartners = [],
}: TopologyGraphProps) {
  const pts = [
    [70, 75],
    [180, 125],
    [300, 70],
    [430, 80],
    [545, 105],
    [535, 205],
    [490, 270],
    [320, 220],
    [90, 225],
    [210, 285],
    [370, 285],
    [405, 165],
  ];

  const connections: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 8],
    [1, 2],
    [1, 7],
    [2, 3],
    [2, 4],
    [3, 5],
    [7, 5],
    [8, 7],
    [7, 6],
    [5, 6],
  ];

  const selectedIdx = meters.findIndex((m) => m.id === selected.id);

  return (
    <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] p-6 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 topology">
      <div className="flex justify-between items-start mb-4">
        <div>
          <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">COMMUNITY TOPOLOGY</label>
          <h2 className="font-semibold text-[20px] font-title mt-1.5 mb-0 mx-0 tracking-[-0.02em] text-[var(--text-primary)]">
            12 active meters <span className="font-mono text-[9px] font-semibold rounded-[20px] py-1 px-2 align-middle ml-1.5 tracking-[0.06em] uppercase bg-[rgba(81,150,200,0.12)] text-[#3b82f6] border border-[rgba(81,150,200,0.15)]">LIVE NETWORK</span>
          </h2>
        </div>
        {activePartners.length > 0 && (
          <span className="font-mono text-[9px] font-semibold rounded-[20px] align-middle ml-1.5 tracking-[0.06em] uppercase bg-[rgba(16,185,129,0.12)] text-lime border border-[rgba(16,185,129,0.15)]" style={{ fontSize: '11px', padding: '4px 10px' }}>
            <span className="inline-block w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_0_4px_var(--lime-glow)] animate-pulse" /> {activePartners.length} active trade{activePartners.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-[14px] network">
        <svg viewBox="0 0 620 310">
          <g className="edges">
            {/* Render base structural connections */}
            {connections.map(([a, b], i) => (
              <line
                key={i}
                x1={pts[a][0]}
                y1={pts[a][1]}
                x2={pts[b][0]}
                y2={pts[b][1]}
                stroke="var(--edge-inactive)"
                strokeWidth="1.5"
                opacity="0.3"
              />
            ))}
          </g>

          {/* Render Historical Shared Partners throughout the day (dashed green lines) */}
          <g className="shared-history-edges">
            {selectedIdx !== -1 &&
              sharedPartners.map((partnerId) => {
                const partnerIdx = meters.findIndex((m) => m.id === partnerId);
                if (partnerIdx === -1 || partnerIdx === selectedIdx) return null;
                return (
                  <line
                    key={partnerId}
                    x1={pts[selectedIdx][0]}
                    y1={pts[selectedIdx][1]}
                    x2={pts[partnerIdx][0]}
                    y2={pts[partnerIdx][1]}
                    stroke="rgba(0, 255, 136, 0.45)"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                );
              })}
          </g>

          {/* Render Active Trade Edges (animated glowing paths) */}
          <g className="active-trade-edges">
            {selectedIdx !== -1 &&
              activePartners.map((partnerId) => {
                const partnerIdx = meters.findIndex((m) => m.id === partnerId);
                if (partnerIdx === -1 || partnerIdx === selectedIdx) return null;
                return (
                  <line
                    key={partnerId}
                    x1={pts[selectedIdx][0]}
                    y1={pts[selectedIdx][1]}
                    x2={pts[partnerIdx][0]}
                    y2={pts[partnerIdx][1]}
                    className="active-trade-line"
                  />
                );
              })}
          </g>

          {/* Render microgrid nodes */}
          {meters.map((m, i) => (
            <g
              key={m.id}
              onClick={() => onSelect(m)}
              className="node"
              transform={`translate(${pts[i][0]},${pts[i][1]})`}
            >
              <circle
                r={m.id === selected.id ? 17 : 12}
                className={`${m.role} ${m.id === selected.id ? 'selected' : ''}`}
              />
              <text y={31} textAnchor="middle">
                {m.id}
              </text>
              {m.id === selected.id && <circle r="21" className="ring" />}
            </g>
          ))}
        </svg>

        <div className="flex gap-4 flex-wrap font-mono text-[11px] text-[var(--text-secondary)] mt-3 mx-0.5 mb-0">
          <span><span className="node-key solar" /> Producer</span>
          <span><span className="node-key prosumer" /> Prosumer</span>
          <span><span className="node-key consumer" /> Consumer</span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                borderTop: '2.5px dashed rgba(0, 255, 136, 0.65)',
                marginRight: '6px',
                verticalAlign: 'middle',
              }}
            />
            Shared Today
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                borderTop: '3.5px dashed var(--lime)',
                marginRight: '6px',
                verticalAlign: 'middle',
              }}
            />
            Active Transfer
          </span>
        </div>
      </div>
    </section>
  );
}
