import { Meter } from '../simulation/model';

interface TopologyGraphProps {
  meters: Meter[];
  selected: Meter;
  onSelect: (m: Meter) => void;
}

export function TopologyGraph({ meters, selected, onSelect }: TopologyGraphProps) {
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

  return (
    <section className="card topology">
      <div className="card-head">
        <div>
          <label>COMMUNITY TOPOLOGY</label>
          <h2>
            12 active meters <span className="pill blue">LIVE NETWORK</span>
          </h2>
        </div>
        <span className="muted small">
          <span className="live-dot" /> 4 trading now
        </span>
      </div>

      <div className="network">
        <svg viewBox="0 0 620 310">
          <g className="edges">
            {connections.map(([a, b], i) => (
              <line
                key={i}
                x1={pts[a][0]}
                y1={pts[a][1]}
                x2={pts[b][0]}
                y2={pts[b][1]}
                className={i < 4 ? 'trade-edge' : ''}
              />
            ))}
          </g>
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
        <div className="network-legend">
          <span><span className="node-key solar" /> Producer</span>
          <span><span className="node-key prosumer" /> Prosumer</span>
          <span><span className="node-key consumer" /> Consumer</span>
          <span><span className="edge-key" /> Active trade</span>
        </div>
      </div>
    </section>
  );
}
