import { useMemo, useRef, useEffect } from 'react';
import { RotateCcw, Zap, TrendingUp, Sun, Gauge } from 'lucide-react';
import { Header, TopologyGraph, SimulationControls, MeterRoleCard, DemandSupplyCurve, EnergyWalletCard } from '../components';
import { Meter, Trade } from '../simulation/model';
import { useSession } from '../auth/SessionContext';

interface OperatorDashboardProps {
  theme: 'dark' | 'light';
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  setInfo: (val: boolean) => void;
  tick: number;
  playing: boolean;
  speed: string;
  meters: Meter[];
  trades: Trade[];
  ledger: Record<string, number>;
  sharedPartners: Record<string, string[]>;
  cumulativeBaseline: number;
  secondsSinceUpdate: number;
  supplyDemandHistory: { tick: number; supply: number; demand: number }[];
  selected: Meter;
  setSelected: (m: Meter) => void;
  handleSetPlaying: (val: boolean) => void;
  handleSetSpeed: (val: string) => void;
  handleSetTick: (val: number) => void;
  handleReset: () => void;
}

export function OperatorDashboard({
  theme,
  setTheme,
  setInfo,
  tick,
  playing,
  speed,
  meters,
  trades,
  ledger,
  sharedPartners,
  cumulativeBaseline,
  secondsSinceUpdate,
  supplyDemandHistory,
  selected,
  setSelected,
  handleSetPlaying,
  handleSetSpeed,
  handleSetTick,
  handleReset,
}: OperatorDashboardProps) {
  const { logout } = useSession();

  const liveSelected = meters.find(m => m.id === selected.id) || meters[0] || selected;

  const stats = useMemo(() => {
    if (!liveSelected || liveSelected.role === 'consumer') {
      return { peakKW: 0, peakTime: '—', avgKW: 0 };
    }
    const i = meters.findIndex(m => m.id === liveSelected.id);
    if (i === -1) return { peakKW: 0, peakTime: '—', avgKW: 0 };

    let totalGen = 0;
    let maxGen = 0;
    let maxTick = 0;

    const hash = (x: number) => {
      const s = Math.sin(x) * 10000;
      return s - Math.floor(s);
    };

    for (let t = 0; t < 96; t++) {
      const hour = (9 + t / 4) % 24;
      const daylight = Math.max(0, Math.min(1, Math.sin(((hour - 6) / 12) * Math.PI)));
      const r1 = hash(t * 13 + i * 37);
      const cloud = 0.72 + r1 * 0.33;
      const genKW = liveSelected.pv * daylight * cloud;
      totalGen += genKW;
      if (genKW > maxGen) {
        maxGen = genKW;
        maxTick = t;
      }
    }

    const avgKW = totalGen / 96;
    const peakHourVal = (9 + maxTick / 4) % 24;
    const hourPart = Math.floor(peakHourVal);
    const minPart = Math.floor((peakHourVal % 1) * 60);
    const timeString = `${hourPart.toString().padStart(2, '0')}:${minPart.toString().padStart(2, '0')}`;

    return {
      peakKW: maxGen,
      peakTime: timeString,
      avgKW: avgKW,
    };
  }, [liveSelected, meters]);

  const supply = meters.reduce((sum, m) => sum + m.generation, 0);
  const demand = meters.reduce((sum, m) => sum + m.load, 0);

  const lmp = useMemo(() => {
    const totalDelivered = trades.reduce((sum, t) => sum + t.delivered, 0);
    if (totalDelivered > 1e-6) {
      return trades.reduce((sum, t) => sum + t.buyerUnitPrice * t.delivered, 0) / totalDelivered;
    }
    if (supply === 0 && demand === 0) return 5.50;
    return Math.max(4.00, Math.min(7.00, (supply * 4.00 + demand * 7.00) / (supply + demand)));
  }, [trades, supply, demand]);

  const previousFlow = useRef<{ supply: number; demand: number } | null>(null);
  const supplyDelta = previousFlow.current ? ((supply - previousFlow.current.supply) / previousFlow.current.supply) * 100 : null;
  const demandDelta = previousFlow.current ? ((demand - previousFlow.current.demand) / previousFlow.current.demand) * 100 : null;

  useEffect(() => {
    previousFlow.current = { supply, demand };
  }, [supply, demand]);

  const activePartners = useMemo(() => {
    const list: string[] = [];
    trades.forEach(t => {
      const seller = meters.find(m => m.name === t.seller || m.id === t.seller);
      const buyer = meters.find(m => m.name === t.buyer || m.id === t.buyer);
      if (seller && buyer) {
        if (seller.id === liveSelected.id) {
          list.push(buyer.id);
        } else if (buyer.id === liveSelected.id) {
          list.push(seller.id);
        }
      }
    });
    return list;
  }, [trades, liveSelected, meters]);

  const recovered = Object.values(ledger).reduce((sum, value) => sum + value, 0);
  const uplift = cumulativeBaseline ? (recovered / cumulativeBaseline) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onInfo={() => setInfo(true)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        lifetimeSavings={1248.50 * 12 + recovered}
      />
      <main className="w-full px-4 sm:px-6 my-0 py-3 pb-3 flex-1">
        <section className="grid grid-cols-[1fr_2fr] gap-6 items-stretch mb-9 max-[850px]:flex max-[850px]:flex-col max-[850px]:gap-5">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[16px] p-6 shadow-[var(--card-shadow)] flex flex-col gap-3 min-w-[320px] max-w-full">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--text-primary)] shadow-[0_0_8px_var(--lime-glow)]" />
                <span className="font-mono font-semibold text-[10px] tracking-[0.1em] text-[var(--text-secondary)]">INSPECT METER</span>
              </div>
              <select
                value={liveSelected.id}
                onChange={(e) => {
                  const met = meters.find(m => m.id === e.target.value);
                  if (met) setSelected(met);
                }}
                className="bg-[rgba(45,45,45,0.06)] dark:bg-[rgba(215,201,174,0.12)] border border-[var(--card-border)] rounded-[6px] py-1 px-2.5 font-sans font-bold text-[10px] uppercase text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                {meters.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                    {m.id} - {m.displayName || m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_1.15fr] gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">METER ID</label>
                <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.id}</span>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <span className="inline-flex items-center gap-1.25 font-mono text-[11px] text-[var(--text-muted)] mt-1">
                  <RotateCcw size={11} /> Updated {secondsSinceUpdate}s ago
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT LOAD</label>
                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                  <Zap size={16} className="flex-shrink-0 opacity-85 text-[#C06B22] dark:text-[#E09852]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.load.toFixed(2)} kW</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">PEAK GENERATION</label>
                <div className="flex flex-col items-end gap-1.5 mt-1.5">
                  <TrendingUp size={16} className="flex-shrink-0 opacity-85 text-[var(--text-primary)] dark:text-[#D7C9AE]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">
                    {stats.peakKW.toFixed(2)} kW <i className="not-italic text-[11px] font-mono text-[var(--text-muted)] font-medium ml-0.5">@ {stats.peakTime}</i>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT GENERATION</label>
                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                  <Sun size={16} className="flex-shrink-0 opacity-85 text-[#C06B22] dark:text-[#E5C378]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.generation.toFixed(2)} kW</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">AVG GENERATION</label>
                <div className="flex flex-col items-end gap-1.5 mt-1.5">
                  <Gauge size={16} className="flex-shrink-0 opacity-85 text-[var(--text-secondary)]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{stats.avgKW.toFixed(2)} kW</span>
                </div>
              </div>
            </div>
          </div>
          <DemandSupplyCurve supply={supply} demand={demand} history={supplyDemandHistory} />
        </section>

        <div className="grid grid-cols-4 bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] backdrop-blur-md rounded-[20px] mb-6 overflow-hidden max-[850px]:grid-cols-2 max-[520px]:grid-cols-1">
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL SUPPLY</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">{supply.toFixed(1)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">kW</i></strong>
            <span className={supplyDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : supplyDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {supplyDelta === null ? '—' : `${supplyDelta >= 0 ? '↑' : '↓'} ${Math.abs(supplyDelta).toFixed(1)}%`}
            </span>
          </div>
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center max-[850px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL DEMAND</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">{demand.toFixed(1)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">kW</i></strong>
            <span className={demandDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : demandDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {demandDelta === null ? '—' : `${demandDelta >= 0 ? '↑' : '↓'} ${Math.abs(demandDelta).toFixed(1)}%`}
            </span>
          </div>
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center bg-mint max-[850px]:border-t max-[850px]:border-[var(--line)] max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL MARGINAL PRICE</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">₹{lmp.toFixed(2)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">/ kWh</i></strong>
            <span className="font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]">Both sides beat the grid default</span>
          </div>
          <div className="p-5 px-6 flex flex-col justify-center max-[850px]:border-t max-[850px]:border-[var(--line)] max-[850px]:border-r-0">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">COMMUNITY BENEFIT TODAY</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">₹{recovered.toFixed(2)}</strong>
            <span className={uplift >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {cumulativeBaseline ? `${uplift >= 0 ? '↑' : '↓'} ${Math.abs(uplift).toFixed(0)}% vs FiT baseline` : '— vs FiT baseline'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-6">
          <TopologyGraph
            meters={meters}
            selected={liveSelected}
            onSelect={setSelected}
            sharedPartners={sharedPartners[liveSelected.id] || []}
            activePartners={activePartners}
          />
          <EnergyWalletCard
            meter={liveSelected}
            meters={meters}
            trades={trades}
            ledger={ledger}
            lmp={lmp}
            cumulativeBaseline={cumulativeBaseline}
          />
        </div>

        <MeterRoleCard
          meter={liveSelected}
          meters={meters}
          lmp={lmp}
          trades={trades}
          earned={ledger[liveSelected.id] || 0}
        />

        <SimulationControls
          playing={playing}
          setPlaying={handleSetPlaying}
          speed={speed}
          setSpeed={handleSetSpeed}
          tick={tick}
          setTick={handleSetTick}
          reset={handleReset}
        />

        <footer className="mt-12 pt-6 pb-8 border-t border-[var(--line)] flex flex-col gap-4 text-[var(--text-muted)] font-mono text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
            <span>© {new Date().getFullYear()} GridShare. Decentralized local energy exchange protocol.</span>
            <span className="text-[var(--text-secondary)]">Local marginal pricing &amp; continuous double auction matching.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
