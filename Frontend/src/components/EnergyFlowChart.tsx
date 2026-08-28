import { Meter } from '../simulation/model';

interface EnergyFlowChartProps {
  meter: Meter;
  earned?: number;
}

export function EnergyFlowChart({ meter, earned = 0 }: EnergyFlowChartProps) {
  const netValue = meter.generation - meter.load;
  const selfConsumption = meter.generation > 0
    ? Math.round(Math.min(100, (meter.load / meter.generation) * 100))
    : 0;

  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <label>YOUR ENERGY FLOW</label>
          <h2>
            {meter.name}{' '}
            <span className={`pill ${meter.status === 'surplus' ? 'green' : 'blue'}`}>
              {meter.status.toUpperCase()}
            </span>
          </h2>
        </div>
        <div className="metric">
          <b>{netValue.toFixed(1)} kW</b>
          <span>net {meter.status === 'surplus' ? 'export' : 'import'}</span>
        </div>
      </div>

      <div className="chart">
        <div className="axis">
          <span>6 kW</span>
          <span>4 kW</span>
          <span>2 kW</span>
          <span>0 kW</span>
        </div>
        <svg viewBox="0 0 620 190" preserveAspectRatio="none">
          <path
            className="area"
            d="M0 150 C70 145 85 120 135 100 S220 35 280 45 S380 75 430 98 S510 130 620 142 L620 190 L0 190Z"
          />
          <path
            className="line solar"
            d="M0 150 C70 145 85 120 135 100 S220 35 280 45 S380 75 430 98 S510 130 620 142"
          />
          <path
            className="line load"
            d="M0 143 C80 130 120 145 180 130 S280 125 350 135 S450 115 510 125 S580 135 620 120"
          />
        </svg>
        <div className="legend">
          <span><span className="dot solar-dot" /> Generation</span>
          <span><span className="dot load-dot" /> Consumption</span>
          <span className="now">NOW</span>
        </div>
      </div>

      <div className="chart-foot">
        <div>
          <small>GENERATION</small>
          <b>{meter.generation.toFixed(1)} kW</b>
        </div>
        <div>
          <small>CONSUMPTION</small>
          <b>{meter.load.toFixed(1)} kW</b>
        </div>
        <div>
          <small>SELF-CONSUMPTION</small>
          <b>{selfConsumption}%</b>
        </div>
        <div>
          <small>{meter.status === 'surplus' ? 'REVENUE TODAY' : 'SAVINGS TODAY'}</small>
          <b className="green-text">+₹{earned.toFixed(2)}</b>
        </div>
      </div>
    </section>
  );
}
